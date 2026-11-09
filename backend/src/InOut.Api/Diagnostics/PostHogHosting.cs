using InOut.Application.Diagnostics;
using InOut.Infrastructure.Diagnostics;
using Microsoft.Extensions.Logging;

namespace InOut.Api.Diagnostics;

public static class PostHogHosting
{
    public static IServiceCollection AddInOutPostHog(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var apiKey = configuration["PostHog:ApiKey"]
            ?? configuration["POSTHOG_API_KEY"]
            ?? configuration["PostHog:ProjectApiKey"];

        var host = configuration["PostHog:Host"]
            ?? configuration["POSTHOG_HOST"]
            ?? configuration["PostHog:HostUrl"]
            ?? "https://us.i.posthog.com";

        services.AddHttpClient(nameof(PostHogAnalytics), client =>
        {
            client.Timeout = TimeSpan.FromSeconds(5);
        })
        .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(5)
        });

        services.AddSingleton<IPostHogAnalytics>(sp =>
        {
            var factory = sp.GetRequiredService<IHttpClientFactory>();
            var client = factory.CreateClient(nameof(PostHogAnalytics));
            var logger = sp.GetService<ILogger<PostHogAnalytics>>();
            return new PostHogAnalytics(client, apiKey, host, logger);
        });

        services.AddSingleton<ProductEventBuffer>();
        services.AddHostedService<ProductEventDispatcher>();

        return services;
    }
}
