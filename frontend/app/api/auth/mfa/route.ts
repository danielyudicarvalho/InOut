import { NextResponse } from "next/server";
import { completeMfa, guardMutation } from "../../../../lib/auth/bff-server";

export async function POST(request: Request) {
  const rejected = await guardMutation(request, true);
  if (rejected) return rejected;
  const body = (await request.json()) as { code?: string };
  const completed = await completeMfa(body.code ?? "");
  if (!completed) {
    return NextResponse.json({ code: "invalid_token" }, { status: 400 });
  }
  return NextResponse.json({ code: "signed_in" });
}
