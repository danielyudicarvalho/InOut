import { NextResponse } from "next/server";
import { healthStatus } from "../../../lib/auth/health-status";

export async function GET() {
  const api = process.env.API_BASE_URL?.replace(/\/$/, "");
  const missing = healthStatus(api);
  if (missing.status === "not-ready") {
    return NextResponse.json(
      { status: "not-ready", api: "unconfigured" },
      { status: 503 },
    );
  }
  try {
    const response = await fetch(`${api}/health/live`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return NextResponse.json({ status: "degraded" }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
  return NextResponse.json({ status: "ready" });
}
