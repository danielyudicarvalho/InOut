/// Snapshot of the household totals shown by the bootstrap application.
///
/// This type deliberately depends only on Dart so the financial domain remains
/// independent from Flutter, persistence, and provider SDKs.
final class HouseholdSummary {
  const HouseholdSummary({
    required this.name,
    required this.balanceInCents,
  });

  final String name;
  final int balanceInCents;
}
