import { NextResponse } from "next/server";
import {
  guardMutation,
  revokeStoredSession,
} from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const rejected = await guardMutation(request, true);
  if (rejected) return rejected;
  await revokeStoredSession();
  return NextResponse.json({ code: "signed_out" });
}
