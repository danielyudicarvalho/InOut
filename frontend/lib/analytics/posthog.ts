import posthog from "posthog-js";
import { scrubProperties } from "./scrub";

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

  initialized = true;
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
}
