using InOut.Domain;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class DomainAssemblyTests
{
    [Fact]
    public void DomainHasTheExpectedAssemblyName()
    {
        Assert.Equal("InOut.Domain", typeof(DomainAssembly).Assembly.GetName().Name);
    }
}
