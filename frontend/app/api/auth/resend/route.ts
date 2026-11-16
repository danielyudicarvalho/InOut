import {
  commandResponse,
  guardMutation,
  identityCommand,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const rejected = await guardMutation(request);
  if (rejected) return rejected;
  const body = (await request.json()) as { email?: string };
  const result = await identityCommand(
    "/api/v1/identity/resend",
    {
      email: body.email ?? "",
    },
    request,
  );
  return commandResponse(result.status, result.payload);
}
