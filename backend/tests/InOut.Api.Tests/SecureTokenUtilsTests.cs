using InOut.Application.Utils;
using Xunit;

namespace InOut.Api.Tests;

public sealed class SecureTokenUtilsTests
{
    [Fact]
    public void GenerateHexReturnsLowercaseCryptographicToken()
    {
        var token = SecureTokenUtils.GenerateHex(24);

        Assert.Equal(48, token.Length);
        Assert.All(token, character => Assert.True(char.IsAsciiHexDigitLower(character)));
    }

    [Fact]
    public void GenerateHexRejectsInvalidLength()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => SecureTokenUtils.GenerateHex(0));
    }
}
