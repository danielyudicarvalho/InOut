import { NextResponse } from "next/server";
import {
  clearSession,
  readSession,
  verifySameOrigin,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ code: "csrf_rejected" }, { status: 403 });
  }
  const session = await readSession();
  const api = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (session?.refreshToken && api && session.refreshToken !== "recovery") {
    await fetch(`${api}/connect/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "inout-web",
        client_secret:
          process.env.AUTH_WEB_CLIENT_SECRET ?? "dev-only-web-client-secret",
        token: session.refreshToken,
        token_type_hint: "refresh_token",
      }),
    }).catch(() => undefined);
  }
  await clearSession();
  return NextResponse.json({ code: "signed_out" });
}
