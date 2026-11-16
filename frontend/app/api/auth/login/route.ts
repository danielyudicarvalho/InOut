import { NextResponse } from "next/server";
import {
  commandResponse,
  guardMutation,
  identityCommand,
  pendingSession,
  sessionFromTicket,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const rejected = await guardMutation(request);
  if (rejected) return rejected;
  const body = (await request.json()) as { email?: string; password?: string };
  const result = await identityCommand(
    "/api/v1/identity/login",
    {
      email: body.email ?? "",
      password: body.password ?? "",
    },
    request,
  );
  if (result.payload.code === "mfa_required" && result.payload.ticket) {
    await pendingSession(result.payload.ticket, "mfa");
    return NextResponse.json({ code: "mfa_required" }, { status: 403 });
  }
  if (result.payload.code === "mfa_recovery_required") {
    return NextResponse.json(
      { code: "mfa_recovery_required" },
      { status: 403 },
    );
  }
  if (result.payload.ticket) {
    await sessionFromTicket(result.payload.ticket, result.payload.user ?? null);
  }
  return commandResponse(result.status, result.payload);
}
