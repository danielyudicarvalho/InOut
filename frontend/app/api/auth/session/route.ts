import { NextResponse } from "next/server";
import { refreshedSession } from "../../../../lib/auth/bff-server";

export async function GET() {
  const session = await refreshedSession();
  if (!session || session.accessToken === "recovery") {
    return NextResponse.json(
      {
        user: session?.user ?? null,
        csrf: null,
        canReset: (session?.recoveryExpiresAt ?? 0) > Date.now(),
        recoveryExpiresAt: session?.recoveryExpiresAt ?? 0,
      },
      { status: session ? 200 : 401 },
    );
  }
  return NextResponse.json({
    user: session.user,
    csrf: session.csrf,
    canReset: (session.recoveryExpiresAt ?? 0) > Date.now(),
    recoveryExpiresAt: session.recoveryExpiresAt ?? 0,
  });
}
