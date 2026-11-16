import {
  commandResponse,
  guardMutation,
  identityCommand,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const rejected = await guardMutation(request);
  if (rejected) return rejected;
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };
  const result = await identityCommand(
    "/api/v1/identity/register",
    {
      email: body.email ?? "",
      password: body.password ?? "",
      name: body.name ?? "",
    },
    request,
  );
  return commandResponse(result.status, result.payload);
}
