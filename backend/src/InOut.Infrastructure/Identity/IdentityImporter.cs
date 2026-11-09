using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using InOut.Application.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Identity;

public sealed class CapturingIdentityMail : IIdentityMail
{
    public List<IdentityMail> Messages { get; } = [];

    public Task SendAsync(IdentityMail message, CancellationToken cancellationToken)
    {
        Messages.Add(message);
        return Task.CompletedTask;
    }
}

public sealed class SmtpIdentityMail(string host, int port, string user, string password, string from) : IIdentityMail
{
    public async Task SendAsync(IdentityMail message, CancellationToken cancellationToken)
    {
        using var client = new SmtpClient(host, port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(user, password)
        };
        using var mail = new MailMessage(from, message.To, message.Subject, message.Text);
        if (!string.IsNullOrWhiteSpace(message.Html))
        {
            mail.IsBodyHtml = true;
            mail.Body = message.Html;
        }
#pragma warning disable SYSLIB0014
        await client.SendMailAsync(mail, cancellationToken);
#pragma warning restore SYSLIB0014
    }
}

public sealed class IdentityImporter(IdentityDbContext db, UserManager<InOutUser> users, TimeProvider clock)
{
    public async Task<IdentityImportPlan> ImportAsync(
        IReadOnlyList<ExportedIdentityUser> rows,
        string sourceSha256,
        CancellationToken cancellationToken)
    {
        var existing = await db.ImportBatches.SingleOrDefaultAsync(
            item => item.SourceSha256 == sourceSha256,
            cancellationToken);
        if (existing is not null)
        {
            return JsonSerializer.Deserialize<IdentityImportPlan>(existing.SummaryJson)
                ?? throw new InvalidOperationException("Stored import summary is unreadable.");
        }

        var plan = LegacyIdentityImportPlanner.Plan(rows, clock.GetUtcNow());
        if (!plan.Accepted)
        {
            return plan;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        foreach (var planned in plan.Users)
        {
            var user = await users.FindByIdAsync(planned.Id.ToString());
            if (user is null)
            {
                user = new InOutUser
                {
                    Id = planned.Id,
                    UserName = planned.Email,
                    Email = planned.Email,
                    EmailConfirmed = planned.EmailConfirmed,
                    DisplayName = planned.DisplayName,
                    BannedUntil = planned.BannedUntil,
                    MfaReenrollmentRequired = planned.MfaReenrollmentRequired,
                    TwoFactorEnabled = planned.MfaReenrollmentRequired,
                    LockoutEnabled = true,
                    PasswordHash = planned.PasswordHash,
                    SecurityStamp = Stamp(),
                    ConcurrencyStamp = Stamp()
                };
                var created = await users.CreateAsync(user);
                if (!created.Succeeded)
                {
                    throw new InvalidOperationException("Identity import could not create " + planned.Id);
                }

                user.PasswordHash = planned.PasswordHash;
                user.SecurityStamp = Stamp();
                await users.UpdateAsync(user);
            }
            else
            {
                user.EmailConfirmed = planned.EmailConfirmed;
                user.BannedUntil = planned.BannedUntil;
                user.MfaReenrollmentRequired = planned.MfaReenrollmentRequired || user.MfaReenrollmentRequired;
                user.TwoFactorEnabled = user.TwoFactorEnabled || planned.MfaReenrollmentRequired;
                if (planned.PasswordHash is not null &&
                    (user.PasswordHash is null ||
                     !user.PasswordHash.StartsWith("AQAAAA", StringComparison.Ordinal)))
                {
                    user.PasswordHash = planned.PasswordHash;
                }

                await users.UpdateAsync(user);
            }

            foreach (var login in planned.Logins)
            {
                var provider = string.IsNullOrWhiteSpace(login.Issuer) ? login.Provider : login.Issuer;
                var known = await users.FindByLoginAsync(provider, login.Subject);
                if (known is null)
                {
                    await users.AddLoginAsync(user, new UserLoginInfo(provider, login.Subject, login.Provider));
                }
                else if (known.Id != user.Id)
                {
                    throw new InvalidOperationException("Provider subject already belongs to another user.");
                }
            }
        }

        db.ImportBatches.Add(new IdentityImportBatch
        {
            Id = Guid.NewGuid(),
            SourceSha256 = sourceSha256,
            CompletedAt = clock.GetUtcNow(),
            SummaryJson = JsonSerializer.Serialize(plan)
        });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return plan;
    }

    public static string SourceHash(string canonicalJson)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(canonicalJson));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string Stamp() =>
        Guid.NewGuid().ToString("N");
}
