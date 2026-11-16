import { NextResponse } from "next/server";
import {
  guardMutation,
  identityCommand,
  pendingSession,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const rejected = await guardMutation(request);
  if (rejected) return rejected;
  const body = (await request.json()) as { email?: string; code?: string };
  const result = await identityCommand(
    "/api/v1/identity/recovery/exchange",
    {
      email: body.email ?? "",
      code: body.code ?? "",
    },
    request,
  );
  if (result.status !== 200 || !result.payload.ticket) {
    return NextResponse.json(
      { code: result.payload.code ?? "recovery_required" },
      { status: 400 },
    );
  }
  const purpose =
    result.payload.code === "mfa_reenrollment_required"
      ? "mfa-enroll"
      : "recovery";
  await pendingSession(request, result.payload.ticket, purpose);
  return NextResponse.json({ code: result.payload.code ?? "signed_in" });
}
