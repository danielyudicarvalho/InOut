using InOut.Application;
using InOut.Domain;
using InOut.Infrastructure;
using Xunit;

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
    public void DomainDoesNotReferenceFrameworkOrOuterLayers()
    {
        AssertDoesNotReference(
            typeof(DomainAssembly).Assembly,
            [.. FrameworkDependencies, "InOut.Application", "InOut.Infrastructure", "InOut.Api"]);
    }

    [Fact]
    public void ApplicationDoesNotReferenceInfrastructureApiOrFrameworks()
    {
        AssertDoesNotReference(
            typeof(ApplicationAssembly).Assembly,
            [.. FrameworkDependencies, "InOut.Infrastructure", "InOut.Api"]);
    }

    [Fact]
    public void InfrastructureDoesNotReferenceApi()
    {
        AssertDoesNotReference(
            typeof(InfrastructureAssembly).Assembly,
            ["InOut.Api"]);
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

    private static string[] ReferenceNames(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(reference => reference.Name!)
            .ToArray();
}
