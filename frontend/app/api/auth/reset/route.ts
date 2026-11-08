import { NextResponse } from "next/server";
import {
  clearSession,
  identityCommand,
  readSession,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const session = await readSession();
  if (
    !session?.recoveryTicket ||
    (session.recoveryExpiresAt ?? 0) <= Date.now()
  ) {
    return NextResponse.json({ code: "recovery_required" }, { status: 400 });
  }
  const body = (await request.json()) as { password?: string };
  const result = await identityCommand("/api/v1/identity/reset", {
    ticket: session.recoveryTicket,
    password: body.password ?? "",
  });
  if (result.status !== 200) {
    return NextResponse.json(
      { code: result.payload.code ?? "invalid_token" },
      { status: result.status },
    );
  }
  await clearSession();
  return NextResponse.json({ code: "signed_in" });
}
