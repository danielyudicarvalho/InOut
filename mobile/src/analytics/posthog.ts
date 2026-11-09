import { PostHog } from "posthog-react-native";

let posthogInstance: PostHog | null = null;

export function initPostHog(): PostHog | null {
  if (posthogInstance) {
    return posthogInstance;
  }

  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    return null;
  }

  try {
    posthogInstance = new PostHog(apiKey, {
      host,
    });
    return posthogInstance;
  } catch (error) {
    console.warn("Failed to initialize PostHog on mobile", error);
    return null;
  }
}

export function captureEvent(
  eventName: string,
  properties?: Record<string, any>,
): void {
  posthogInstance?.capture(eventName, properties);
}

export function identifyUser(
  userId: string,
  traits?: Record<string, any>,
): void {
  posthogInstance?.identify(userId, traits);
}

export function resetUser(): void {
  posthogInstance?.reset();
}

export function getPostHog(): PostHog | null {
  return posthogInstance;
}
