import { PostHog } from "posthog-react-native";

let posthogInstance: PostHog | null = null;

// Called at module load from the root layout so the first screen is tracked.
export function initPostHog(): PostHog | null {
  if (posthogInstance) return posthogInstance;

  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return null;

  try {
    posthogInstance = new PostHog(apiKey, {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      personProfiles: "identified_only",
      captureAppLifecycleEvents: true,
      // Financial screens: no screen recording. Errors are Sentry's job.
      enableSessionReplay: false,
    });
    return posthogInstance;
  } catch (error) {
    console.warn("Failed to initialize PostHog on mobile", error);
    return null;
  }
}

export function captureEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean | null>,
): void {
  posthogInstance?.capture(eventName, properties);
}

// Route path only (expo-router pathname has no query string).
export function captureScreen(pathname: string): void {
  void posthogInstance?.screen(pathname);
}

// Only the opaque user id is sent: no e-mail, name or household data.
export function identifyUser(userId: string): void {
  if (!posthogInstance || posthogInstance.getDistinctId() === userId) return;
  posthogInstance.identify(userId);
}

export function resetUser(): void {
  if (!posthogInstance) return;
  if (posthogInstance.getDistinctId() === posthogInstance.getAnonymousId())
    return;
  posthogInstance.reset();
}
