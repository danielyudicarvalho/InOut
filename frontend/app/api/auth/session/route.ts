import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, refreshToken, expiresIn } = body;

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json(
        { error: "accessToken is required" },
        { status: 400 },
      );
    }

    const res = NextResponse.json({ ok: true });
    const isProduction = process.env.NODE_ENV === "production";

    // Set HttpOnly access token session cookie
    res.cookies.set("inout-session", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: typeof expiresIn === "number" ? expiresIn : 60 * 60 * 24 * 7, // 7 days
    });

    // Set HttpOnly refresh token cookie if present
    if (refreshToken && typeof refreshToken === "string") {
      res.cookies.set("inout-refresh-token", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return res;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const isProduction = process.env.NODE_ENV === "production";

  // Expire HttpOnly session cookies
  res.cookies.set("inout-session", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  res.cookies.set("inout-refresh-token", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get("inout-session")?.value;
  return NextResponse.json({ authenticated: Boolean(sessionToken) });
}
