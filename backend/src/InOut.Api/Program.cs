using System.Text.Json;
using System.Text.Json.Serialization;
using InOut.Api;
using InOut.Api.Financial;
using InOut.Api.Households;
using InOut.Api.Middleware;
using InOut.Api.Security;
using InOut.Application.Financial;
using InOut.Application.Households;
using InOut.Application.Idempotency;
using InOut.Application.Security;
using InOut.Infrastructure.Financial;
using InOut.Infrastructure.Households;
using InOut.Infrastructure.Idempotency;
using InOut.Infrastructure.Persistence;
using InOut.Infrastructure.Security;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<HouseholdExceptionHandler>();
builder.Services.AddExceptionHandler<FinancialExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddSupabaseAuthentication(builder.Configuration);
builder.Services.AddHouseholdAuthorization();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(
            builder.Configuration.GetSection(ApiContract.Configuration.AllowedOrigins).Get<string[]>() ?? [])
        .AllowAnyHeader()
        .AllowAnyMethod()));

var databaseConnection = builder.Configuration.GetConnectionString(ApiContract.Configuration.DatabaseConnection)
    ?? throw new InvalidOperationException("ConnectionStrings:InOut is required.");
builder.Services.AddSingleton(_ => new NpgsqlDataSourceBuilder(databaseConnection).Build());
builder.Services.AddDbContext<InOutDbContext>(options => options.UseNpgsql(databaseConnection));
builder.Services.AddScoped<IHouseholdMembershipReader, EfHouseholdMembershipReader>();
builder.Services.AddScoped<IHouseholdStore, EfHouseholdStore>();
builder.Services.AddScoped<HouseholdService>();
builder.Services.AddScoped<ILedgerStore, EfLedgerStore>();
builder.Services.AddScoped<LedgerService>();
builder.Services.AddSingleton<IIdempotencyPolicy, IdempotencyPolicy>();
builder.Services.AddScoped<IInboxMessageProcessor, EfInboxMessageProcessor>();
builder.Services.AddSingleton(TimeProvider.System);

var app = builder.Build();

app.UseExceptionHandler();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

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

app.MapHouseholdEndpoints();
app.MapLedgerEndpoints();

app.MapHealthChecks(
    ApiContract.Routes.Liveness,
    new HealthCheckOptions { Predicate = _ => false });

app.MapHealthChecks(ApiContract.Routes.Readiness);

app.Run();

public partial class Program;
