/** Same-origin relative paths only. Rejects protocol-relative, backslash, and control-character open redirects. */
export function safeNextPath(
  value: string | null | undefined,
  origin = "http://localhost",
): string | null {
  if (!value) return null;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 0x20) return null;
  }
  if (/%(?:0[0-9a-fA-F]|1[0-9a-fA-F]|5[cC])/.test(value)) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("\\") || value.includes("://")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value.slice(1))) return null;
  try {
    const base = new URL(origin);
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return null;
    if (resolved.username || resolved.password) return null;
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    for (let index = 0; index < path.length; index += 1) {
      if (path.charCodeAt(index) < 0x20) return null;
    }
    if (path.includes("\\")) return null;
    return path;
  } catch {
    return null;
  }
}
