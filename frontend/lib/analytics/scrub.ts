// Auth links carry one-time codes and e-mail addresses in the query string
// (/auth/callback?email=…&code=…). Telemetry must never receive them, so every
// URL-like value leaves the browser without its query string or fragment.

export function scrubUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value;
  }
}

export function scrubProperties<T extends Record<string, unknown>>(
  properties: T | undefined,
): T | undefined {
  if (!properties) return properties;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    clean[key] = typeof value === "string" ? scrubUrl(value) : value;
  }
  return clean as T;
}
