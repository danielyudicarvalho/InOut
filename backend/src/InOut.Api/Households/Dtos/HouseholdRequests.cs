namespace InOut.Api.Households;

public sealed record CreateHouseholdRequest(string? Name);
public sealed record AcceptHouseholdInvitationRequest(string? Code);
