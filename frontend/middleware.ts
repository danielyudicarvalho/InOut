import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that strictly require authentication
const PROTECTED_PREFIXES = [
  "/inicio",
  "/lancamentos",
  "/lancamento",
  "/novo-registro",
  "/composicao-saldo",
  "/resumo-categorias",
  "/verificando-lancamento",
  "/resolver-duplicidade",
  "/historico-correcoes",
  "/despesas",
  "/receitas",
  "/fontes-renda",
  "/criar-residencia",
  "/criar-conta",
  "/configuracao-inicial",
  "/conta-pronta",
];

// Routes for anonymous users only (e.g. login/signup)
const ANONYMOUS_ONLY_ROUTES = ["/entrar", "/comecar"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAnonymousOnlyPath(pathname: string): boolean {
  return ANONYMOUS_ONLY_ROUTES.some((route) => pathname === route);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Retrieve session token from HttpOnly cookie or Supabase project cookie fallback
  const sessionCookie =
    req.cookies.get("inout-session")?.value ||
    req.cookies.getAll().find((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"))
      ?.value;

  const isAuthenticated = Boolean(sessionCookie);

  // 1. Protected routes: If not authenticated, redirect to /entrar with 'next' parameter
  if (isProtectedPath(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/entrar", req.url);
      const returnUrl = `${pathname}${search}`;

      // Avoid open-redirect vulnerabilities: must start with single slash
      if (returnUrl.startsWith("/") && !returnUrl.startsWith("//")) {
        loginUrl.searchParams.set("next", returnUrl);
      }

      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Anonymous-only routes: If already authenticated, redirect to destination or /inicio
  if (isAnonymousOnlyPath(pathname)) {
    if (isAuthenticated) {
      const nextParam = req.nextUrl.searchParams.get("next");
      const validNext =
        nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
          ? nextParam
          : "/inicio";

      return NextResponse.redirect(new URL(validNext, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, svg, icons
     * - API routes (/api/*)
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
