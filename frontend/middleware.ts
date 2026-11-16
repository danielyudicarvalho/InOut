import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName } from "./lib/auth/session-cookie";
import { safeNextPath } from "./lib/auth/safe-next";

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
  const isAuthenticated = Boolean(req.cookies.get(sessionCookieName())?.value);

  if (isProtectedPath(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/entrar", req.url);
      const next = safeNextPath(`${pathname}${search}`);
      if (next) loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isAnonymousOnlyPath(pathname) && isAuthenticated) {
    const next =
      safeNextPath(req.nextUrl.searchParams.get("next")) ?? "/inicio";
    return NextResponse.redirect(new URL(next, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
