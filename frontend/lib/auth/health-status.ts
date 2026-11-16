export function healthStatus(apiBase: string | undefined): {
  status: "ready" | "not-ready" | "degraded";
  httpStatus: number;
  api?: string;
} {
  if (!apiBase) {
    return { status: "not-ready", httpStatus: 503, api: "unconfigured" };
  }
  return { status: "ready", httpStatus: 200 };
}
