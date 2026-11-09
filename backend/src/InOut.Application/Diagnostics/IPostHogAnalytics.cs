namespace InOut.Application.Diagnostics;

public interface IPostHogAnalytics
{
    Task CaptureAsync(
        string distinctId,
        string eventName,
        IReadOnlyDictionary<string, object?>? properties = null,
        CancellationToken cancellationToken = default);

    Task IdentifyAsync(
        string distinctId,
        IReadOnlyDictionary<string, object?>? properties = null,
        CancellationToken cancellationToken = default);
}
