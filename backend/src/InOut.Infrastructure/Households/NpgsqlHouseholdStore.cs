using InOut.Application.Households;
using InOut.Domain.Households;
using Npgsql;

namespace InOut.Infrastructure.Households;

public sealed class NpgsqlHouseholdStore(NpgsqlDataSource dataSource) : IHouseholdStore
{
    public async Task<IReadOnlyList<Household>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await BeginForUserAsync(connection, userId, cancellationToken);
        await using var command = new NpgsqlCommand(
            """
            select h.id, h.name
            from public.households h
            join public.household_members m on m.household_id = h.id
            where m.user_id = $1
            order by h.name
            """,
            connection,
            transaction);
        command.Parameters.AddWithValue(userId);

        var households = new List<Household>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            households.Add(new Household(reader.GetGuid(0), reader.GetString(1)));
        }

        await reader.CloseAsync();
        await transaction.CommitAsync(cancellationToken);
        return households;
    }

    public async Task<Household> CreateAsync(
        Guid userId,
        string name,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await BeginForUserAsync(connection, userId, cancellationToken);
        var householdId = Guid.NewGuid();

        await ExecuteAsync(
            connection,
            transaction,
            "insert into public.households (id, name, created_by) values ($1, $2, $3)",
            cancellationToken,
            householdId,
            name,
            userId);
        await ExecuteAsync(
            connection,
            transaction,
            "insert into public.household_members (household_id, user_id, role) values ($1, $2, 'owner')",
            cancellationToken,
            householdId,
            userId);
        await AuditAsync(
            connection,
            transaction,
            householdId,
            userId,
            "household.created",
            "household",
            householdId,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return new Household(householdId, name);
    }

    public async Task SaveInvitationAsync(
        Guid userId,
        Guid householdId,
        byte[] tokenHash,
        DateTimeOffset expiresAt,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await BeginForUserAsync(connection, userId, cancellationToken);

        await LockHouseholdAsync(connection, transaction, householdId, cancellationToken);
        var role = await ScalarAsync<string?>(
            connection,
            transaction,
            "select role from public.household_members where household_id = $1 and user_id = $2",
            cancellationToken,
            householdId,
            userId);
        if (!string.Equals(role, "owner", StringComparison.Ordinal))
        {
            throw new HouseholdRuleException("owner_required", "Only a household owner can create an invitation.");
        }

        var memberCount = await ScalarAsync<long>(
            connection,
            transaction,
            "select count(*) from public.household_members where household_id = $1",
            cancellationToken,
            householdId);
        if (memberCount >= HouseholdRules.MaximumMembers)
        {
            throw new HouseholdRuleException("household_full", "Household already has two members.");
        }

        await ExecuteAsync(
            connection,
            transaction,
            "delete from private.household_invitations where household_id = $1 and accepted_at is null",
            cancellationToken,
            householdId);
        var invitationId = await ScalarAsync<Guid>(
            connection,
            transaction,
            """
            insert into private.household_invitations
                (household_id, token_hash, created_by, expires_at)
            values ($1, $2, $3, $4)
            returning id
            """,
            cancellationToken,
            householdId,
            tokenHash,
            userId,
            expiresAt);
        await AuditAsync(
            connection,
            transaction,
            householdId,
            userId,
            "household.invitation.created",
            "household_invitation",
            invitationId,
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<Household> AcceptInvitationAsync(
        Guid userId,
        byte[] tokenHash,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await BeginForUserAsync(connection, userId, cancellationToken);
        await using var invitationCommand = new NpgsqlCommand(
            """
            select i.id, i.household_id
            from private.household_invitations i
            where i.token_hash = $1 and i.accepted_at is null and i.expires_at > now()
            for update of i
            """,
            connection,
            transaction);
        invitationCommand.Parameters.AddWithValue(tokenHash);

        Guid invitationId;
        Guid householdId;
        await using (var reader = await invitationCommand.ExecuteReaderAsync(cancellationToken))
        {
            if (!await reader.ReadAsync(cancellationToken))
            {
                throw new HouseholdRuleException("invalid_invite", "Invalid or expired invitation.");
            }

            invitationId = reader.GetGuid(0);
            householdId = reader.GetGuid(1);
        }

        var alreadyMember = await ScalarAsync<bool>(
            connection,
            transaction,
            "select exists (select 1 from public.household_members where household_id = $1 and user_id = $2)",
            cancellationToken,
            householdId,
            userId);
        if (alreadyMember)
        {
            throw new HouseholdRuleException("already_member", "User is already a household member.");
        }

        var memberCount = await ScalarAsync<long>(
            connection,
            transaction,
            "select count(*) from public.household_members where household_id = $1",
            cancellationToken,
            householdId);
        if (memberCount >= HouseholdRules.MaximumMembers)
        {
            throw new HouseholdRuleException("household_full", "Household already has two members.");
        }

        try
        {
            await ExecuteAsync(
                connection,
                transaction,
                "insert into public.household_members (household_id, user_id, role) values ($1, $2, 'member')",
                cancellationToken,
                householdId,
                userId);
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new HouseholdRuleException("already_member", "User is already a household member.");
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.CheckViolation)
        {
            throw new HouseholdRuleException("household_full", "Household already has two members.");
        }

        await ExecuteAsync(
            connection,
            transaction,
            "update private.household_invitations set accepted_by = $1, accepted_at = now() where id = $2",
            cancellationToken,
            userId,
            invitationId);
        await AuditAsync(
            connection,
            transaction,
            householdId,
            userId,
            "household.invitation.accepted",
            "household_invitation",
            invitationId,
            cancellationToken);
        var householdName = await ScalarAsync<string>(
            connection,
            transaction,
            "select name from public.households where id = $1",
            cancellationToken,
            householdId);
        await transaction.CommitAsync(cancellationToken);
        return new Household(householdId, householdName);
    }

    private static async Task<NpgsqlTransaction> BeginForUserAsync(
        NpgsqlConnection connection,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await ExecuteAsync(
            connection,
            transaction,
            "select set_config('request.jwt.claim.sub', $1, true)",
            cancellationToken,
            userId.ToString());
        return transaction;
    }

    private static Task LockHouseholdAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid householdId,
        CancellationToken cancellationToken) => ExecuteAsync(
            connection,
            transaction,
            "select id from public.households where id = $1 for update",
            cancellationToken,
            householdId);

    private static Task AuditAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid householdId,
        Guid userId,
        string action,
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken) => ExecuteAsync(
            connection,
            transaction,
            """
            insert into public.audit_events
                (household_id, actor_user_id, action, entity_type, entity_id, outcome)
            values ($1, $2, $3, $4, $5, 'success')
            """,
            cancellationToken,
            householdId,
            userId,
            action,
            entityType,
            entityId);

    private static async Task ExecuteAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string sql,
        CancellationToken cancellationToken,
        params object[] values)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        foreach (var value in values)
        {
            command.Parameters.AddWithValue(value);
        }

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<T> ScalarAsync<T>(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string sql,
        CancellationToken cancellationToken,
        params object[] values)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        foreach (var value in values)
        {
            command.Parameters.AddWithValue(value);
        }

        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is null or DBNull ? default! : (T)value;
    }
}
