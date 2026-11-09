import {
  commandResponse,
  identityCommand,
  sessionFromTicket,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const result = await identityCommand("/api/v1/identity/login", {
    email: body.email ?? "",
    password: body.password ?? "",
  });
  if (result.payload.ticket) {
    await sessionFromTicket(result.payload.ticket, result.payload.user ?? null);
  }
  return commandResponse(result.status, result.payload);
}
