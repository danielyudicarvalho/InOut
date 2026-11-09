using System.Text.Json;
using System.Text.Json.Serialization;
using InOut.Api;
using InOut.Api.Diagnostics;
using InOut.Api.Identity;
using InOut.Api.Financial;
using InOut.Api.Households;
using InOut.Api.Middleware;
using InOut.Api.Security;
using InOut.Application.Financial;
using InOut.Application.Financial.Dashboard;
using InOut.Application.Financial.Export;
using InOut.Application.Financial.Forecasts;
using InOut.Application.Financial.Planning;
using InOut.Application.Financial.RecurringPlans;
using InOut.Application.Households;
using InOut.Application.Idempotency;
using InOut.Application.Security;
using InOut.Infrastructure.Financial;
using InOut.Infrastructure.Households;
using InOut.Infrastructure.Idempotency;
using InOut.Infrastructure.Persistence;
using InOut.Infrastructure.Security;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;

if (args is ["migrate"])
{
    Environment.ExitCode = await InOut.Api.Identity.SchemaMigrator.RunAsync(args);
    return;
}

var builder = WebApplication.CreateBuilder(args);

var sentryDsn = builder.Configuration["Sentry:Dsn"] ?? builder.Configuration["SENTRY_DSN"];
if (!string.IsNullOrWhiteSpace(sentryDsn))
{
    builder.WebHost.UseSentry(options =>
    {
        options.Dsn = sentryDsn;
        options.TracesSampleRate = builder.Configuration.GetValue("Sentry:TracesSampleRate", 0.1);
        options.Environment = builder.Environment.EnvironmentName;
        options.AttachStacktrace = true;
        options.SendDefaultPii = false;
        // Expected business outcomes, already answered as 4xx problem details.
        options.AddExceptionFilterForType<InOut.Domain.Households.HouseholdRuleException>();
        options.AddExceptionFilterForType<InOut.Domain.Financial.FinancialRuleException>();
        options.AddExceptionFilterForType<IdempotencyException>();
    });
}

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

builder.Services.AddProblemDetails();
builder.Services.AddCustomObservability(builder.Configuration);
builder.Services.AddInOutPostHog(builder.Configuration);
builder.Services.AddExceptionHandler<HouseholdExceptionHandler>();
builder.Services.AddExceptionHandler<FinancialExceptionHandler>();
builder.Services.AddExceptionHandler<UnhandledExceptionHandler>();
builder.Services.Configure<ExceptionHandlerOptions>(options =>
    options.SuppressDiagnosticsCallback = _ => true);
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddInOutIdentity(builder.Configuration, builder.Environment);
builder.Services.AddAntiforgery(options =>
{
    options.Cookie.Name = "inout_antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.HeaderName = "X-CSRF-TOKEN";
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("identity", httpContext =>
    {
        var clientIp = httpContext.Request.Headers["fly-client-ip"].FirstOrDefault()
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "local";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            clientIp,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });
});
builder.Services.AddHouseholdAuthorization();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(
            builder.Configuration.GetSection(ApiContract.Configuration.AllowedOrigins).Get<string[]>() ?? [])
        .AllowAnyHeader()
        .AllowAnyMethod()));

builder.Services.AddScoped<IHouseholdMembershipReader, EfHouseholdMembershipReader>();
builder.Services.AddScoped<IHouseholdStore, EfHouseholdStore>();
builder.Services.AddScoped<HouseholdService>();
builder.Services.AddScoped<ILedgerStore, EfLedgerStore>();
builder.Services.AddScoped<LedgerService>();
builder.Services.AddScoped<IRecurringPlanStore, EfRecurringPlanStore>();
builder.Services.AddScoped<RecurringPlanService>();
builder.Services.AddScoped<IForecastStore, EfForecastStore>();
builder.Services.AddScoped<ForecastService>();
builder.Services.AddScoped<IPlanningStore, EfPlanningStore>();
builder.Services.AddScoped<PlanningService>();
builder.Services.AddScoped<IDashboardReader, EfDashboardReader>();
builder.Services.AddScoped<GetFinancialDashboard>();
builder.Services.AddScoped<GetFinancialAnalysis>();
builder.Services.AddScoped<GetIncomeBreakdown>();
builder.Services.AddScoped<GetExpenseBreakdown>();
builder.Services.AddScoped<CompareFinancialPeriods>();
builder.Services.AddScoped<IFinancialExportReader, EfFinancialExportReader>();
builder.Services.AddScoped<ExportFinancialData>();
builder.Services.AddSingleton<IIdempotencyPolicy, IdempotencyPolicy>();
builder.Services.AddScoped<IInboxMessageProcessor, EfInboxMessageProcessor>();
builder.Services.AddSingleton(TimeProvider.System);

if (args is ["import", var importPath])
{
    var importMode = builder.Configuration["IdentityImport:Mode"];
    InOut.Application.Identity.IdentityImportGate.Require(importMode, builder.Environment.IsProduction());
    var bytes = await InOut.Api.Identity.IdentityImportCommand.ReadLocalAsync(importPath, CancellationToken.None);
    var rows = InOut.Api.Identity.IdentityImportCommand.Parse(bytes);
    await using var host = builder.Build();
    await host.PrepareIdentityAsync();
    await using var scope = host.Services.CreateAsyncScope();
    var importer = scope.ServiceProvider.GetRequiredService<InOut.Infrastructure.Identity.IdentityImporter>();
    var plan = await importer.ImportAsync(
        rows,
        InOut.Infrastructure.Identity.IdentityImporter.SourceHash(System.Text.Encoding.UTF8.GetString(bytes)),
        CancellationToken.None);
    if (plan.Accepted &&
        string.Equals(
            importMode,
            InOut.Application.Identity.IdentityImportGate.ApprovedCutover,
            StringComparison.Ordinal))
    {
        var accounts = scope.ServiceProvider.GetRequiredService<InOut.Application.Identity.IIdentityAccounts>();
        foreach (var user in plan.Users)
        {
            await accounts.RevokeSessionsAsync(user.Id, CancellationToken.None);
        }
    }

    Console.WriteLine(JsonSerializer.Serialize(new
    {
        accepted = plan.Accepted,
        code = plan.Code,
        counts = plan.Counts
    }));
    Environment.ExitCode = plan.Accepted ? 0 : 2;
    return;
}

var app = builder.Build();
await app.PrepareIdentityAsync();

app.UseForwardedHeaders();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseExceptionHandler();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet(ApiContract.Routes.SystemInfo, () => Results.Ok(new
{
    service = ApiContract.ResponseValues.ServiceName,
    status = ApiContract.ResponseValues.Ready
}))
    .WithName(ApiContract.EndpointNames.GetSystemInfo);

app.MapGet(
    ApiContract.Routes.HouseholdAccess,
    (Guid householdId) => Results.Ok(new
    {
        householdId,
        access = ApiContract.ResponseValues.AccessGranted
    }))
    .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
    .WithName(ApiContract.EndpointNames.CheckHouseholdAccess);

app.MapIdentityEndpoints();
app.MapHouseholdEndpoints();
app.MapLedgerEndpoints();
app.MapRecurringPlanEndpoints();
app.MapForecastEndpoints();
app.MapPlanningEndpoints();

app.MapHealthChecks(
    ApiContract.Routes.Liveness,
    new HealthCheckOptions { Predicate = _ => false });

app.MapHealthChecks(ApiContract.Routes.Readiness);

app.UseOpenTelemetryPrometheusScrapingEndpoint();

app.Run();

public partial class Program;
