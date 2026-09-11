using InOut.Application.Security;
using Npgsql;

namespace InOut.Infrastructure.Security;

public sealed class NpgsqlHouseholdMembershipReader(NpgsqlDataSource dataSource)
    : IHouseholdMembershipReader
{
    public async Task<bool> IsMemberAsync(
        Guid userId,
        Guid householdId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var setSubject = new NpgsqlCommand(
            "select set_config('request.jwt.claim.sub', $1, true)",
            connection,
            transaction))
        {
            setSubject.Parameters.AddWithValue(userId.ToString());
            await setSubject.ExecuteNonQueryAsync(cancellationToken);
        }

        await using var command = new NpgsqlCommand(
            """
            select exists (
                select 1
                from public.household_members
                where household_id = $1 and user_id = $2
            )
            """,
            connection,
            transaction);
        command.Parameters.AddWithValue(householdId);
        command.Parameters.AddWithValue(userId);

        var isMember = (bool)(await command.ExecuteScalarAsync(cancellationToken) ?? false);
        await transaction.CommitAsync(cancellationToken);
        return isMember;
    }
}
