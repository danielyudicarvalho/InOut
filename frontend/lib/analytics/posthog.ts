import posthog from "posthog-js";

let initialized = false;

export function initPostHog(): void {
  if (typeof window === "undefined" || initialized) {
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    return;
  }

  posthog.init(apiKey, {
    api_host: apiHost,
    person_profiles: "identified_only",
    capture_pageview: false, // captured manually on route transitions
    autocapture: true,
  });

  initialized = true;
}

export function captureEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined" || !initialized) {
    return;
  }
  posthog.capture(eventName, properties);
}

export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
): void {
  if (typeof window === "undefined" || !initialized) {
    return;
  }
  posthog.identify(userId, traits);
}

export function resetUser(): void {
  if (typeof window === "undefined" || !initialized) {
    return;
  }
  posthog.reset();
}

export { posthog };
