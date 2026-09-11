using Microsoft.AspNetCore.Authorization;

namespace InOut.Api.Security;

public static class HouseholdAuthorizationExtensions
{
    public static IServiceCollection AddHouseholdAuthorization(this IServiceCollection services)
    {
        services.AddAuthorization(options =>
            options.AddPolicy(
                HouseholdMemberRequirement.PolicyName,
                policy => policy
                    .RequireAuthenticatedUser()
                    .AddRequirements(new HouseholdMemberRequirement())));
        services.AddScoped<IAuthorizationHandler, HouseholdMemberAuthorizationHandler>();
        return services;
    }
}
