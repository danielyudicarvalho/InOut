import {
  commandResponse,
  identityCommand,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const result = await identityCommand("/api/v1/identity/forgot", {
    email: body.email ?? "",
  });
  return commandResponse(result.status, result.payload);
}
