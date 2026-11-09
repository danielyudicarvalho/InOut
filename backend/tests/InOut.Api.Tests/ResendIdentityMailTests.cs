using System.Net;
using System.Text.Json;
using InOut.Application.Identity;
using InOut.Infrastructure.Identity;
using Xunit;

namespace InOut.Api.Tests;

public sealed class ResendIdentityMailTests
{
    private sealed class MockHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(handler(request));
        }
    }

    [Fact]
    public async Task SendAsyncSendsCorrectHeadersAndPayload()
    {
        HttpRequestMessage? capturedRequest = null;
        string? capturedBody = null;

        var handler = new MockHttpMessageHandler(req =>
        {
            capturedRequest = req;
            capturedBody = req.Content?.ReadAsStringAsync().GetAwaiter().GetResult();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"id\":\"msg_123\"}")
            };
        });

        using var httpClient = new HttpClient(handler);
        var mailer = new ResendIdentityMail(httpClient, "re_test_key_123", "InOut <noreply@inout.app>");

        var mail = new IdentityMail(
            "user@example.com",
            "Confirmar e-mail",
            "Código 12345678",
            "<h1>Código 12345678</h1>");

        await mailer.SendAsync(mail, CancellationToken.None);

        Assert.NotNull(capturedRequest);
        Assert.Equal("https://api.resend.com/emails", capturedRequest.RequestUri?.ToString());
        Assert.Equal("Bearer", capturedRequest.Headers.Authorization?.Scheme);
        Assert.Equal("re_test_key_123", capturedRequest.Headers.Authorization?.Parameter);

        Assert.NotNull(capturedBody);
        using var doc = JsonDocument.Parse(capturedBody);
        var root = doc.RootElement;
        Assert.Equal("InOut <noreply@inout.app>", root.GetProperty("from").GetString());
        Assert.Equal("user@example.com", root.GetProperty("to")[0].GetString());
        Assert.Equal("Confirmar e-mail", root.GetProperty("subject").GetString());
        Assert.Equal("Código 12345678", root.GetProperty("text").GetString());
        Assert.Equal("<h1>Código 12345678</h1>", root.GetProperty("html").GetString());
    }

    [Fact]
    public async Task SendAsyncThrowsOnApiError()
    {
        var handler = new MockHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)
        {
            Content = new StringContent("{\"error\":\"invalid_api_key\"}")
        });

        using var httpClient = new HttpClient(handler);
        var mailer = new ResendIdentityMail(httpClient, "re_invalid", "InOut <noreply@inout.app>");

        var mail = new IdentityMail("user@example.com", "Test", "Plain text");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => mailer.SendAsync(mail, CancellationToken.None));

        Assert.Contains("Unauthorized", ex.Message);
        Assert.Contains("invalid_api_key", ex.Message);
    }

    [Fact]
    public void EmailTemplatesGenerateValidHtml()
    {
        var confirmationHtml = EmailTemplates.ConfirmationEmailHtml("87654321", "https://app.inout.com/callback?code=87654321", 15);
        Assert.Contains("87654321", confirmationHtml);
        Assert.Contains("https://app.inout.com/callback?code=87654321", confirmationHtml);
        Assert.Contains("15 minutos", confirmationHtml);

        var resetHtml = EmailTemplates.PasswordResetEmailHtml("11223344", "https://app.inout.com/reset?code=11223344", 60);
        Assert.Contains("11223344", resetHtml);
        Assert.Contains("https://app.inout.com/reset?code=11223344", resetHtml);
        Assert.Contains("60 minutos", resetHtml);

        var existingHtml = EmailTemplates.ExistingAccountEmailHtml();
        Assert.Contains("Conta InOut existente", existingHtml);
    }
}
