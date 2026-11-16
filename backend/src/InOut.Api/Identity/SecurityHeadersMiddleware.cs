namespace InOut.Api.Identity;

public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task Invoke(HttpContext http)
    {
        http.Response.Headers["X-Content-Type-Options"] = "nosniff";
        http.Response.Headers["X-Frame-Options"] = "DENY";
        http.Response.Headers["Referrer-Policy"] = "no-referrer";
        http.Response.Headers["Content-Security-Policy"] =
            "default-src 'none'; base-uri 'none'; form-action 'self'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'";
        if (http.Request.IsHttps)
        {
            http.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
        }

        return next(http);
    }
}
