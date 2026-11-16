import { NextResponse } from "next/server";
import { readCsrf, resolveSession } from "../../../../lib/auth/bff-server";

export async function GET(request: Request) {
  const session = await resolveSession(request);
  const csrf = await readCsrf();
  if (!session || session.purpose !== "authenticated") {
    return NextResponse.json(
      {
        user: session?.user ?? null,
        csrf: session ? csrf : null,
        canReset: session?.purpose === "recovery",
        recoveryExpiresAt: 0,
        purpose: session?.purpose ?? null,
      },
      { status: session ? 200 : 401 },
    );
  }
  return NextResponse.json({
    user: session.user,
    csrf,
    canReset: false,
    recoveryExpiresAt: 0,
    purpose: session.purpose,
  });
}
