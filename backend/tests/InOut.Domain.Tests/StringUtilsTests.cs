using InOut.Domain.Utils;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class StringUtilsTests
{
    [Theory]
    [InlineData(" value ", "value")]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public void TrimToNullNormalizesOptionalText(string? input, string? expected)
    {
        Assert.Equal(expected, StringUtils.TrimToNull(input));
    }

    [Fact]
    public void CaseNormalizersTrimBeforeChangingCase()
    {
        Assert.Equal("abcdef", StringUtils.NormalizeLower(" ABCdef "));
        Assert.Equal("ABCDEF", StringUtils.NormalizeUpper(" abcDef "));
    }
}
