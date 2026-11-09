import type { ErrorEvent } from "@sentry/nextjs";
import { scrubUrl } from "../analytics/scrub";

// Shared by the client, server and edge Sentry runtimes.
export function sentryOptions(dsn: string | undefined) {
  const rate = Number.parseFloat(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "",
  );
  return {
    dsn,
    enabled: Boolean(dsn),
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number.isFinite(rate) ? rate : 0.1,
    sendDefaultPii: false,
    beforeSend(event: ErrorEvent) {
      if (event.request?.url) event.request.url = scrubUrl(event.request.url);
      if (event.request) delete event.request.query_string;
      return event;
    },
  };
}
