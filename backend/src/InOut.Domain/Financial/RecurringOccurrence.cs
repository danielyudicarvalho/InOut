namespace InOut.Domain.Financial;

public sealed record RecurringOccurrence
{
    private RecurringOccurrence(
        Guid id,
        Guid householdId,
        Guid planId,
        DateOnly scheduledOn,
        Guid transactionId,
        FinancialFlow flow,
        long amountCents,
        string currency,
        Guid realizedBy,
        DateTimeOffset realizedAt)
    {
        Id = id;
        HouseholdId = householdId;
        PlanId = planId;
        ScheduledOn = scheduledOn;
        TransactionId = transactionId;
        Flow = flow;
        AmountCents = amountCents;
        Currency = currency;
        RealizedBy = realizedBy;
        RealizedAt = realizedAt;
    }

    public Guid Id { get; }

    public Guid HouseholdId { get; }

    public Guid PlanId { get; }

    public DateOnly ScheduledOn { get; }

    public Guid TransactionId { get; }

    public FinancialFlow Flow { get; }

    public long AmountCents { get; }

    public string Currency { get; }

    public Guid RealizedBy { get; }

    public DateTimeOffset RealizedAt { get; }

    public static RecurringOccurrence Link(
        Guid id,
        RecurringPlan plan,
        DateOnly scheduledOn,
        FinancialTransaction transaction,
        Guid actorUserId,
        DateTimeOffset realizedAt,
        IReadOnlyCollection<RecurringOccurrence> existing)
    {
        if (id == Guid.Empty || actorUserId == Guid.Empty)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidRecurringPlan,
                "Occurrence and actor identifiers are required.");
        }

        plan.EnsureCanExecute();
        if (!plan.Produces(scheduledOn))
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidRecurringPlan,
                "Only a date this plan produces can be realized.");
        }

        if (existing.Any(item => item.PlanId != plan.Id || item.HouseholdId != plan.HouseholdId))
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidRecurringPlan,
                "Occurrence history must belong to this plan.");
        }

        if (existing.Any(item => item.ScheduledOn == scheduledOn || item.TransactionId == transaction.Id))
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.RecurringOccurrenceAlreadyRealized,
                "This predicted date was already realized.");
        }

        var entry = transaction.Entries.Count == 1 ? transaction.Entries[0] : null;
        var expectedDirection = plan.Flow == FinancialFlow.Income
            ? EntryDirection.Credit
            : EntryDirection.Debit;
        var expectedKind = plan.Flow == FinancialFlow.Income
            ? FinancialTransactionKind.Income
            : FinancialTransactionKind.Expense;
        if (transaction.HouseholdId != plan.HouseholdId ||
            transaction.Kind != expectedKind ||
            transaction.Status != FinancialTransactionStatus.Posted ||
            transaction.OccurredOn != scheduledOn ||
            transaction.CreatedBy != actorUserId ||
            transaction.IncomeSourceId != plan.IncomeSourceId ||
            transaction.Description != plan.Name ||
            transaction.ReversalOf is not null ||
            entry is null ||
            entry.AccountId != plan.AccountId ||
            entry.CategoryId != plan.CategoryId ||
            entry.Direction != expectedDirection ||
            entry.Amount.Cents != plan.Amount.Cents ||
            entry.Amount.Currency != plan.Amount.Currency)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidRecurringPlan,
                "The ledger transaction must match this plan's current terms and the predicted date.");
        }

        return new RecurringOccurrence(
            id,
            plan.HouseholdId,
            plan.Id,
            scheduledOn,
            transaction.Id,
            plan.Flow,
            entry.Amount.Cents,
            entry.Amount.Currency,
            actorUserId,
            realizedAt);
    }

    public static RecurringOccurrence Restore(
        Guid id,
        Guid householdId,
        Guid planId,
        DateOnly scheduledOn,
        Guid transactionId,
        FinancialFlow flow,
        long amountCents,
        string currency,
        Guid realizedBy,
        DateTimeOffset realizedAt) =>
        new(id, householdId, planId, scheduledOn, transactionId, flow, amountCents, currency, realizedBy, realizedAt);
}

public sealed record RecurringRealization(RecurringOccurrence Occurrence, FinancialTransaction Transaction);
