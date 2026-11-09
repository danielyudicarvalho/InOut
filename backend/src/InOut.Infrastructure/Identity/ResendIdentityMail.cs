using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using InOut.Application.Identity;

namespace InOut.Infrastructure.Identity;

public sealed class ResendIdentityMail(HttpClient httpClient, string apiKey, string from) : IIdentityMail
{
    private static readonly Uri ResendApiEndpoint = new("https://api.resend.com/emails");

    public async Task SendAsync(IdentityMail message, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);

        using var request = new HttpRequestMessage(HttpMethod.Post, ResendApiEndpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var payload = new ResendEmailRequest
        {
            From = from,
            To = [message.To],
            Subject = message.Subject,
            Text = message.Text,
            Html = string.IsNullOrWhiteSpace(message.Html) ? null : message.Html
        };

        request.Content = new StringContent(
            JsonSerializer.Serialize(payload, ResendJsonContext.Default.ResendEmailRequest),
            Encoding.UTF8,
            "application/json");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Resend email delivery failed with status {response.StatusCode}: {error}");
        }
    }
}

internal sealed class ResendEmailRequest
{
    [JsonPropertyName("from")]
    public string From { get; set; } = "";

    [JsonPropertyName("to")]
    public string[] To { get; set; } = [];

    [JsonPropertyName("subject")]
    public string Subject { get; set; } = "";

    [JsonPropertyName("text")]
    public string Text { get; set; } = "";

    [JsonPropertyName("html")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Html { get; set; }
}

[JsonSerializable(typeof(ResendEmailRequest))]
internal sealed partial class ResendJsonContext : JsonSerializerContext
{
}
