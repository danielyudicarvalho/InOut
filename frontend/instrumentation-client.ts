import * as Sentry from "@sentry/nextjs";
import { initPostHog } from "./lib/analytics/posthog";
import { scrubUrl } from "./lib/analytics/scrub";
import { sentryOptions } from "./lib/monitoring/sentry-options";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    ...sentryOptions(dsn),
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "navigation" && breadcrumb.data) {
        for (const key of ["from", "to"] as const) {
          const value: unknown = breadcrumb.data[key];
          if (typeof value === "string")
            breadcrumb.data[key] = value.split(/[?#]/, 1)[0];
        }
      }
      if (typeof breadcrumb.data?.url === "string")
        breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
      return breadcrumb;
    },
  });
}

initPostHog();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
