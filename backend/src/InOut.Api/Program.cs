using InOut.Api.Middleware;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseExceptionHandler();
app.UseMiddleware<CorrelationIdMiddleware>();

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

app.MapHealthChecks(
    "/health/live",
    new HealthCheckOptions { Predicate = _ => false });

app.MapHealthChecks("/health/ready");

app.Run();

public partial class Program;
