import posthog from "posthog-js";
import { setFinanceTelemetry } from "@inout/finance";
import { scrubProperties } from "./scrub";

// Event Taxonomy §4: sent with every web event.
const SCHEMA_VERSION = 1;

let initialized = false;

// Called once from instrumentation-client.ts, before the app hydrates, so the
// first pageview of a hard load is not lost.
export function initPostHog(): void {
  if (typeof window === "undefined" || initialized) return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  posthog.init(apiKey, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    // Pageviews on load and on every client-side navigation.
    capture_pageview: "history_change",
    // Financial screens: never record clicked text, the screen or the console.
    autocapture: false,
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    enable_recording_console_log: false,
    // Errors are Sentry's job.
    capture_exceptions: false,
    before_send: (event) => {
      if (!event) return event;
      event.properties = scrubProperties(event.properties) ?? {};
      event.$set = scrubProperties(event.$set);
      event.$set_once = scrubProperties(event.$set_once);
      return event;
    },
  });

  posthog.register({
    source: "web",
    client: "web",
    schema_version: SCHEMA_VERSION,
    app_version: process.env.INOUT_APP_VERSION ?? "0.0.0",
  });
  setFinanceTelemetry((event, properties) => captureEvent(event, properties));

  initialized = true;
}

// Household-scoped events are grouped by household (opaque id only).
export function setHousehold(householdId: string | null | undefined): void {
  if (!initialized || !householdId) return;
  posthog.group("household", householdId);
}

export function captureEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (!initialized) return;
  posthog.capture(eventName, properties);
}

// Only the opaque user id is sent: no e-mail, name or household data.
export function identifyUser(userId: string): void {
  if (!initialized) return;
  if (posthog.get_distinct_id() === userId) return;
  posthog.identify(userId);
}

export function resetUser(): void {
  if (!initialized) return;
  if (posthog.get_property("$user_state") !== "identified") return;
  posthog.reset();
  // reset() clears super properties; restore the taxonomy ones.
  posthog.register({
    source: "web",
    client: "web",
    schema_version: SCHEMA_VERSION,
    app_version: process.env.INOUT_APP_VERSION ?? "0.0.0",
  });
}
