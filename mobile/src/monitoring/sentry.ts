import * as Sentry from "@sentry/react-native";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const rate = Number.parseFloat(
    process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "",
  );
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
    tracesSampleRate: Number.isFinite(rate) ? rate : 0.1,
    sendDefaultPii: false,
  });

  initialized = true;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
}

export { Sentry };
