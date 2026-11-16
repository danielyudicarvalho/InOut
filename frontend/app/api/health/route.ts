import { NextResponse } from "next/server";

export async function GET() {
  const api = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (!api) {
    return NextResponse.json({ status: "ready", api: "unconfigured" });
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
