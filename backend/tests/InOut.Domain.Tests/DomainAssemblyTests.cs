using InOut.Domain;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class DomainAssemblyTests
{
    [Fact]
    public void Domain_has_the_expected_assembly_name()
    {
        Assert.Equal("InOut.Domain", typeof(DomainAssembly).Assembly.GetName().Name);
    }
}
