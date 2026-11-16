import { NextResponse } from "next/server";
import {
  guardMutation,
  identityCommand,
  pendingSession,
  resolveSession,
  revokeStoredSession,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const rejected = await guardMutation(request, true);
  if (rejected) return rejected;
  const session = await resolveSession();
  if (
    (session?.purpose !== "recovery" && session?.purpose !== "mfa-enroll") ||
    !session.pendingTicket
  ) {
    return NextResponse.json({ code: "recovery_required" }, { status: 400 });
  }
  const body = (await request.json()) as { password?: string };
  const result = await identityCommand(
    "/api/v1/identity/reset",
    {
      ticket: session.pendingTicket,
      password: body.password ?? "",
    },
    request,
  );
  if (result.status !== 200) {
    return NextResponse.json(
      { code: result.payload.code ?? "invalid_token" },
      { status: result.status },
    );
  }
  await revokeStoredSession();
  if (
    result.payload.code === "mfa_reenrollment_required" &&
    result.payload.ticket
  ) {
    await pendingSession(result.payload.ticket, "mfa-enroll");
    return NextResponse.json({ code: "mfa_reenrollment_required" });
  }
  return NextResponse.json({ code: "signed_in" });
}
