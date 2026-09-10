using InOut.Application;
using InOut.Domain;
using InOut.Infrastructure;

namespace InOut.ArchitectureTests;

public sealed class DependencyDirectionTests
{
    private static readonly string[] FrameworkDependencies =
    [
        "Microsoft.AspNetCore",
        "Microsoft.EntityFrameworkCore",
        "Npgsql",
        "Supabase"
    ];

    [Fact]
    public void Domain_does_not_reference_framework_or_outer_layers()
    {
        AssertDoesNotReference(
            typeof(DomainAssembly).Assembly,
            [.. FrameworkDependencies, "InOut.Application", "InOut.Infrastructure", "InOut.Api"]);
    }

    [Fact]
    public void Application_references_domain_but_not_infrastructure_or_api()
    {
        var references = ReferenceNames(typeof(ApplicationAssembly).Assembly);

        Assert.Contains("InOut.Domain", references);
        Assert.DoesNotContain("InOut.Infrastructure", references);
        Assert.DoesNotContain("InOut.Api", references);
        Assert.DoesNotContain(references, IsFrameworkDependency);
    }

    [Fact]
    public void Infrastructure_may_reference_application_and_domain()
    {
        var references = ReferenceNames(typeof(InfrastructureAssembly).Assembly);

        Assert.Contains("InOut.Application", references);
        Assert.Contains("InOut.Domain", references);
        Assert.DoesNotContain("InOut.Api", references);
    }

    private static void AssertDoesNotReference(
        System.Reflection.Assembly assembly,
        IReadOnlyCollection<string> forbidden)
    {
        var references = ReferenceNames(assembly);
        Assert.DoesNotContain(references, name =>
            forbidden.Any(item =>
                name.Equals(item, StringComparison.Ordinal) ||
                name.StartsWith($"{item}.", StringComparison.Ordinal)));
    }

    private static bool IsFrameworkDependency(string name) =>
        FrameworkDependencies.Any(dependency =>
            name.Equals(dependency, StringComparison.Ordinal) ||
            name.StartsWith($"{dependency}.", StringComparison.Ordinal));

    private static string[] ReferenceNames(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(reference => reference.Name!)
            .ToArray();
}
