using InOut.Api.Households;
using InOut.Api.Middleware;
using InOut.Api.Security;
using InOut.Application.Households;
using InOut.Application.Security;
using InOut.Infrastructure.Households;
using InOut.Infrastructure.Security;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<HouseholdExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddSupabaseAuthentication(builder.Configuration);
builder.Services.AddHouseholdAuthorization();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
        .AllowAnyHeader()
        .AllowAnyMethod()));

var databaseConnection = builder.Configuration.GetConnectionString("InOut")
    ?? throw new InvalidOperationException("ConnectionStrings:InOut is required.");
builder.Services.AddSingleton(_ => new NpgsqlDataSourceBuilder(databaseConnection).Build());
builder.Services.AddScoped<IHouseholdMembershipReader, NpgsqlHouseholdMembershipReader>();
builder.Services.AddScoped<IHouseholdStore, NpgsqlHouseholdStore>();
builder.Services.AddScoped<HouseholdService>();
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

app.MapGet("/api/v1/system/info", () => Results.Ok(new
{
    service = "InOut.Api",
    status = "ready"
}))
    .WithName("GetSystemInfo");

app.MapGet(
    "/api/v1/households/{householdId:guid}/access",
    (Guid householdId) => Results.Ok(new { householdId, access = "granted" }))
    .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
    .WithName("CheckHouseholdAccess");

app.MapHouseholdEndpoints();

app.MapHealthChecks(
    "/health/live",
    new HealthCheckOptions { Predicate = _ => false });

app.MapHealthChecks("/health/ready");

app.Run();

public partial class Program;
