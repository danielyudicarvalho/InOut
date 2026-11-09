import * as Sentry from "@sentry/react-native";

let initialized = false;

export function initSentry(): void {
  if (initialized) {
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    debug: false,
    tracesSampleRate: 1.0,
  });

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    return;
  }
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string): void {
  if (!initialized) {
    return;
  }
  Sentry.captureMessage(message);
}

export { Sentry };
