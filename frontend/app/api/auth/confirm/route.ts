import {
  commandResponse,
  identityCommand,
  sessionFromTicket,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; code?: string };
  const result = await identityCommand("/api/v1/identity/confirm", {
    email: body.email ?? "",
    code: body.code ?? "",
  });
  if (result.payload.ticket) {
    await sessionFromTicket(result.payload.ticket, result.payload.user ?? null);
  }
  return commandResponse(result.status, result.payload);
}
