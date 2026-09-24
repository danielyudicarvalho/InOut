using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data;

namespace InOut.Infrastructure.Persistence;

internal static class DatabaseUserSessionExtensions
{
    public static async Task<IDbContextTransaction> BeginUserTransactionAsync(
        this InOutDbContext dbContext,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var subjectSetting = PersistenceVocabulary.SessionSettings.JwtSubject;
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select set_config({subjectSetting}, {userId.ToString()}, true)",
            cancellationToken);
        return transaction;
    }

    public static async Task<IDbContextTransaction> BeginUserSnapshotAsync(
        this InOutDbContext dbContext,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.RepeatableRead,
            cancellationToken);
        var subjectSetting = PersistenceVocabulary.SessionSettings.JwtSubject;
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select set_config({subjectSetting}, {userId.ToString()}, true)",
            cancellationToken);
        return transaction;
    }
}
