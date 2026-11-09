import {
  commandResponse,
  identityCommand,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };
  const result = await identityCommand("/api/v1/identity/register", {
    email: body.email ?? "",
    password: body.password ?? "",
    name: body.name ?? "",
  });
  return commandResponse(result.status, result.payload);
}
