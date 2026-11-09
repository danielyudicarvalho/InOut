using System.Security.Claims;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using InOut.Application.Identity;
using InOut.Infrastructure.Identity;
using InOut.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using OpenIddict.Abstractions;
using OpenIddict.Validation.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace InOut.Api.Identity;

public static class IdentityHosting
{
    public const string MobileClientId = "inout-mobile";
    public const string WebClientId = "inout-web";
    public const string TicketGrant = "identity_ticket";
    public const string StampClaim = "stamp";
    public const string DevelopmentWebSecret = "dev-only-web-client-secret";

    public static IServiceCollection AddInOutIdentity(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        var production = environment.IsProduction();
        NpgsqlPoolSettings.EnsureSessionPooling(configuration["Database:PoolMode"] ?? NpgsqlPoolSettings.SessionPoolMode);
        var runtimeConnection = configuration.GetConnectionString(ApiContract.Configuration.DatabaseConnection)
            ?? throw new InvalidOperationException("ConnectionStrings:InOut is required.");
        NpgsqlPoolSettings.RejectDisabledTransport(runtimeConnection, production);
        var maxPool = configuration.GetValue("Database:MaxPoolSize", 10);
        if (production)
        {
            EnsureProduction(configuration, maxPool);
        }

        var runtimeBuilder = new NpgsqlConnectionStringBuilder(runtimeConnection);
        NpgsqlPoolSettings.ApplyRuntimePool(runtimeBuilder, maxPool);
        var dataSource = new NpgsqlDataSourceBuilder(runtimeBuilder.ConnectionString).Build();
        services.AddSingleton(dataSource);
        services.AddDbContext<InOut.Infrastructure.Persistence.InOutDbContext>(options =>
            options.UseNpgsql(dataSource));

        var provider = configuration["Database:Provider"] ?? "npgsql";
        if (string.Equals(provider, "sqlite", StringComparison.OrdinalIgnoreCase))
        {
            if (production)
            {
                throw new InvalidOperationException("SQLite is only a disposable test provider.");
            }

            var connection = new SqliteConnection(configuration.GetConnectionString("Identity")
                ?? "Data Source=file:inout-identity?mode=memory&cache=shared");
            connection.Open();
            services.AddSingleton(connection);
            services.AddDbContext<IdentityDbContext>(options => options.UseSqlite(connection));
        }
        else
        {
            services.AddDbContext<IdentityDbContext>(options =>
                options.UseNpgsql(dataSource, npgsql =>
                    npgsql.MigrationsHistoryTable("__ef_migrations", "identity")));
        }

        services.AddIdentity<InOutUser, IdentityRole<Guid>>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.SignIn.RequireConfirmedEmail = true;
            })
            .AddEntityFrameworkStores<IdentityDbContext>()
            .AddDefaultTokenProviders();
        services.AddScoped<IPasswordHasher<InOutUser>, InOutPasswordHasher>();
        services.Configure<AuthenticationOptions>(options =>
        {
            options.DefaultAuthenticateScheme = "inout-auth";
            options.DefaultChallengeScheme = "inout-auth";
        });
        services.AddAuthentication()
            .AddPolicyScheme("inout-auth", "inout-auth", options =>
                options.ForwardDefaultSelector = context =>
                    context.Request.Headers.ContainsKey("Authorization")
                        ? OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme
                        : IdentityConstants.ApplicationScheme);
        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "inout_identity";
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = production
                ? CookieSecurePolicy.Always
                : CookieSecurePolicy.SameAsRequest;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.LoginPath = "/account/login";
            options.ReturnUrlParameter = "returnUrl";
            options.SlidingExpiration = true;
            options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
        });

        var issuer = configuration["Auth:Issuer"];
        if (string.IsNullOrWhiteSpace(issuer))
        {
            if (production)
            {
                throw new InvalidOperationException("Auth:Issuer is required.");
            }

            issuer = "http://localhost:8080/";
        }

        services.AddOpenIddict()
            .AddCore(options => options.UseEntityFrameworkCore().UseDbContext<IdentityDbContext>())
            .AddServer(options =>
            {
                options.SetIssuer(new Uri(issuer, UriKind.Absolute));
                options.SetAuthorizationEndpointUris("/connect/authorize")
                    .SetTokenEndpointUris("/connect/token")
                    .SetRevocationEndpointUris("/connect/revoke")
                    .SetUserInfoEndpointUris("/connect/userinfo");
                options.AllowAuthorizationCodeFlow()
                    .AllowRefreshTokenFlow()
                    .AllowCustomFlow(TicketGrant)
                    .RequireProofKeyForCodeExchange();
                options.RegisterScopes(Scopes.OpenId, Scopes.Email, Scopes.Profile, Scopes.OfflineAccess);
                options.SetAccessTokenLifetime(TimeSpan.FromMinutes(10));
                options.SetRefreshTokenLifetime(TimeSpan.FromDays(14));
                options.UseReferenceAccessTokens();
                options.UseReferenceRefreshTokens();
                if (production)
                {
                    options.AddSigningCertificate(LoadCertificate(
                        configuration["Auth:SigningCertificatePem"]!,
                        configuration["Auth:SigningCertificateKey"]!));
                    options.AddEncryptionCertificate(LoadCertificate(
                        configuration["Auth:EncryptionCertificatePem"]!,
                        configuration["Auth:EncryptionCertificateKey"]!));
                }
                else
                {
                    options.AddDevelopmentSigningCertificate();
                    options.AddDevelopmentEncryptionCertificate();
                }

                var aspnet = options.UseAspNetCore()
                    .EnableAuthorizationEndpointPassthrough()
                    .EnableTokenEndpointPassthrough()
                    .EnableUserInfoEndpointPassthrough();
                if (!production || configuration.GetValue<bool>("Auth:DisableTransportSecurityRequirement"))
                {
                    aspnet.DisableTransportSecurityRequirement();
                }
            })
            .AddValidation(options =>
            {
                options.UseLocalServer();
                options.UseAspNetCore();
            });

        services.AddDataProtection()
            .PersistKeysToDbContext<IdentityDbContext>()
            .SetApplicationName("InOut");
        var delivery = configuration["Auth:Email:Delivery"] ?? (production ? "" : "capture");
        if (production && delivery is not "smtp" and not "resend")
        {
            throw new InvalidOperationException("Production email delivery must be smtp or resend. Capture delivery is refused.");
        }

        if (string.Equals(delivery, "resend", StringComparison.OrdinalIgnoreCase))
        {
            var apiKey = configuration["Auth:Resend:ApiKey"] ?? configuration["RESEND_API_KEY"];
            var from = configuration["Auth:Email:From"] ?? configuration["Auth:Resend:From"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("Resend API key is required when Auth:Email:Delivery is resend.");
            }
            if (string.IsNullOrWhiteSpace(from))
            {
                from = "InOut <onboarding@resend.dev>";
            }

            services.AddHttpClient("Resend");
            services.AddSingleton<IIdentityMail>(provider =>
            {
                var factory = provider.GetRequiredService<IHttpClientFactory>();
                return new ResendIdentityMail(factory.CreateClient("Resend"), apiKey, from);
            });
        }
        else if (string.Equals(delivery, "smtp", StringComparison.OrdinalIgnoreCase))
        {
            var host = configuration["Auth:Email:Host"];
            var from = configuration["Auth:Email:From"];
            var user = configuration["Auth:Email:Username"];
            var password = configuration["Auth:Email:Password"];
            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from) ||
                string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
            {
                throw new InvalidOperationException("SMTP host, from address, username, and password are required.");
            }

            var port = configuration.GetValue("Auth:Email:Port", 587);
            services.AddSingleton<IIdentityMail>(_ => new SmtpIdentityMail(host, port, user, password, from));
        }
        else
        {
            services.AddSingleton<CapturingIdentityMail>();
            services.AddSingleton<IIdentityMail>(provider => provider.GetRequiredService<CapturingIdentityMail>());
        }

        services.AddScoped<IdentityAccountService>();
        services.AddScoped<IIdentityAccounts>(provider =>
        {
            var accounts = provider.GetRequiredService<IdentityAccountService>();
            accounts.PublicOrigin = configuration["Auth:PublicOrigin"] ?? issuer;
            return accounts;
        });
        services.AddScoped<IdentityImporter>();
        return services;
    }

    public static async Task PrepareIdentityAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        if (string.Equals(app.Configuration["Database:Provider"], "sqlite", StringComparison.OrdinalIgnoreCase))
        {
            await db.Database.EnsureCreatedAsync();
        }

        await SyncClientsAsync(scope.ServiceProvider, app.Configuration, app.Environment);
    }

    public static string WebClientSecret(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var secret = configuration["Auth:WebClientSecret"];
        if (!string.IsNullOrWhiteSpace(secret))
        {
            return secret;
        }

        if (environment.IsProduction())
        {
            throw new InvalidOperationException("Auth:WebClientSecret is required.");
        }

        return DevelopmentWebSecret;
    }

    private static void EnsureProduction(IConfiguration configuration, int maxPool)
    {
        if (!configuration.GetValue<bool>("Deployment:RegionApproved"))
        {
            throw new InvalidOperationException(
                "Deployment:RegionApproved is false. gru is only a candidate and is not an approved region.");
        }

        if (string.IsNullOrWhiteSpace(configuration["Deployment:Region"]))
        {
            throw new InvalidOperationException("Deployment:Region is required.");
        }

        var machines = configuration.GetValue("Database:MachineCount", 0);
        var workers = configuration.GetValue("Database:WorkerProcessCount", 0);
        var limit = configuration.GetValue("Database:ClusterClientLimit", 0);
        if (machines < 1 || limit < 1)
        {
            throw new InvalidOperationException("Database machine count and cluster client limit are required.");
        }

        var total = NpgsqlPoolSettings.AggregateClientConnections(machines, workers, maxPool, 2);
        if (total > limit)
        {
            throw new InvalidOperationException(
                $"Aggregate database connections {total} exceed the cluster client limit {limit}.");
        }

        foreach (var name in new[]
        {
            "Auth:SigningCertificatePem",
            "Auth:SigningCertificateKey",
            "Auth:EncryptionCertificatePem",
            "Auth:EncryptionCertificateKey"
        })
        {
            if (string.IsNullOrWhiteSpace(configuration[name]))
            {
                throw new InvalidOperationException(name + " is required in production.");
            }
        }
    }

    private static async Task SyncClientsAsync(
        IServiceProvider services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        var manager = services.GetRequiredService<IOpenIddictApplicationManager>();
        var mobile = Mobile(configuration);
        foreach (var uri in Redirects(configuration, "Auth:MobileRedirectUris", mobile: true))
        {
            mobile.RedirectUris.Add(uri);
        }

        var web = Web(configuration);
        foreach (var uri in Redirects(configuration, "Auth:WebRedirectUris", mobile: false))
        {
            web.RedirectUris.Add(uri);
        }

        await UpsertAsync(manager, mobile, secret: null);
        await UpsertAsync(manager, web, WebClientSecret(configuration, environment));
    }

    private static OpenIddictApplicationDescriptor Mobile(IConfiguration configuration) => new()
    {
        ClientId = configuration["Auth:MobileClientId"] ?? MobileClientId,
        ClientType = ClientTypes.Public,
        ConsentType = ConsentTypes.Implicit,
        DisplayName = "InOut mobile",
        RedirectUris = { },
        Permissions =
        {
            Permissions.Endpoints.Authorization,
            Permissions.Endpoints.Token,
            Permissions.Endpoints.Revocation,
            Permissions.GrantTypes.AuthorizationCode,
            Permissions.GrantTypes.RefreshToken,
            Permissions.ResponseTypes.Code,
            Permissions.Scopes.Email,
            Permissions.Scopes.Profile,
            Permissions.Prefixes.Scope + Scopes.OpenId,
            Permissions.Prefixes.Scope + Scopes.OfflineAccess
        },
        Requirements = { Requirements.Features.ProofKeyForCodeExchange }
    };

    private static OpenIddictApplicationDescriptor Web(IConfiguration configuration) => new()
    {
        ClientId = configuration["Auth:WebClientId"] ?? WebClientId,
        ClientType = ClientTypes.Confidential,
        ConsentType = ConsentTypes.Implicit,
        DisplayName = "InOut web",
        Permissions =
        {
            Permissions.Endpoints.Token,
            Permissions.Endpoints.Revocation,
            Permissions.GrantTypes.RefreshToken,
            Permissions.Prefixes.GrantType + TicketGrant,
            Permissions.Scopes.Email,
            Permissions.Scopes.Profile,
            Permissions.Prefixes.Scope + Scopes.OpenId,
            Permissions.Prefixes.Scope + Scopes.OfflineAccess
        }
    };

    private static async Task UpsertAsync(
        IOpenIddictApplicationManager manager,
        OpenIddictApplicationDescriptor descriptor,
        string? secret)
    {
        if (secret is not null)
        {
            descriptor.ClientSecret = secret;
        }

        var current = await manager.FindByClientIdAsync(descriptor.ClientId!);
        if (current is null)
        {
            await manager.CreateAsync(descriptor);
            return;
        }

        await manager.PopulateAsync(descriptor, current);
        if (secret is not null)
        {
            descriptor.ClientSecret = secret;
        }

        await manager.UpdateAsync(current, descriptor);
    }

    public static IReadOnlyList<Uri> Redirects(IConfiguration configuration, string key, bool mobile)
    {
        var configured = configuration.GetSection(key).Get<string[]>() ?? [];
        if (configured.Length == 0)
        {
            configured = mobile
                ? ["inout://auth/callback", "inout://auth/recuperar"]
                : ["http://localhost:3000/api/auth/callback"];
        }

        var uris = new List<Uri>(configured.Length);
        foreach (var value in configured)
        {
            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
                !string.IsNullOrEmpty(uri.UserInfo) ||
                !string.IsNullOrEmpty(uri.Query) ||
                !string.IsNullOrEmpty(uri.Fragment) ||
                value.Contains('*', StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Redirect URIs must be exact absolute URIs without queries, fragments, or wildcards.");
            }

            uris.Add(uri);
        }

        return uris;
    }

    private static X509Certificate2 LoadCertificate(string certificatePem, string keyPem)
    {
        var created = X509Certificate2.CreateFromPem(certificatePem, keyPem);
        return X509CertificateLoader.LoadPkcs12(created.Export(X509ContentType.Pkcs12), password: null);
    }
}

public static class IdentityPrincipal
{
    public static ClaimsPrincipal Create(InOutUser user, IEnumerable<string> scopes)
    {
        var identity = new ClaimsIdentity(
            authenticationType: OpenIddict.Server.AspNetCore.OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            nameType: Claims.Name,
            roleType: Claims.Role);
        identity.SetClaim(Claims.Subject, user.Id.ToString());
        identity.SetClaim(Claims.Email, user.Email);
        identity.SetClaim(Claims.Name, user.DisplayName ?? user.Email);
        identity.SetClaim(IdentityHosting.StampClaim, user.SecurityStamp);
        var principal = new ClaimsPrincipal(identity);
        principal.SetScopes(scopes);
        principal.SetResources("inout-api");
        foreach (var claim in principal.Claims)
        {
            claim.SetDestinations(Destinations.AccessToken, Destinations.IdentityToken);
        }

        return principal;
    }
}
