import { NextResponse } from "next/server";
import {
  identityCommand,
  readSession,
  writeSession,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; code?: string };
  const result = await identityCommand("/api/v1/identity/recovery/exchange", {
    email: body.email ?? "",
    code: body.code ?? "",
  });
  if (result.status !== 200 || !result.payload.ticket) {
    return NextResponse.json(
      { code: result.payload.code ?? "recovery_required" },
      { status: 400 },
    );
  }
  const current = await readSession();
  await writeSession(
    {
      access_token: current?.accessToken ?? "recovery",
      refresh_token: current?.refreshToken ?? "recovery",
      expires_in: current
        ? Math.max(1, Math.floor((current.expiresAt - Date.now()) / 1000))
        : 60,
    },
    current?.user ?? result.payload.user ?? null,
    { ticket: result.payload.ticket, expiresAt: Date.now() + 15 * 60 * 1000 },
  );
  return NextResponse.json({ code: "signed_in" });
}
