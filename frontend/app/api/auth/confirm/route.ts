import {
  commandResponse,
  guardMutation,
  identityCommand,
  sessionFromTicket,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const rejected = await guardMutation(request);
  if (rejected) return rejected;
  const body = (await request.json()) as { email?: string; code?: string };
  const result = await identityCommand(
    "/api/v1/identity/confirm",
    {
      email: body.email ?? "",
      code: body.code ?? "",
    },
    request,
  );
  if (result.payload.ticket) {
    await sessionFromTicket(
      request,
      result.payload.ticket,
      result.payload.user ?? null,
    );
  }
  return commandResponse(result.status, result.payload);
}
