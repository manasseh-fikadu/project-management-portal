import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "session";
const DEFAULT_AUTH_ME_TIMEOUT_MS = 4000;
const MIN_AUTH_ME_TIMEOUT_MS = 100;

const parsedAuthMeTimeoutMs = Number.parseInt(process.env.AUTH_ME_TIMEOUT_MS ?? "", 10);
const AUTH_ME_TIMEOUT_MS =
  Number.isFinite(parsedAuthMeTimeoutMs) && parsedAuthMeTimeoutMs > 0
    ? Math.max(parsedAuthMeTimeoutMs, MIN_AUTH_ME_TIMEOUT_MS)
    : DEFAULT_AUTH_ME_TIMEOUT_MS;

async function verifySessionForEdge(token: string, secret: string): Promise<{ userId: string } | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as { userId: string };
  } catch {
    return null;
  }
}

async function shouldForcePasswordChange(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get("cookie");

  if (!cookie) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(new URL("/api/auth/me", request.url), {
        headers: { cookie },
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return true;
    }

    const data = (await response.json()) as { user?: { mustChangePassword?: boolean } | null };
    return Boolean(data.user?.mustChangePassword);
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.SESSION_SECRET;

  const isAuthPage = pathname.startsWith("/login");
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isApiAuth = pathname === "/api/auth" || pathname.startsWith("/api/auth/");
  const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");
  const isDonorPortal = pathname.startsWith("/donor-portal");

  if (isApiAuth) {
    return NextResponse.next();
  }

  if (isApiRoute) {
    return NextResponse.next();
  }

  // Donor portal pages are public — no auth required
  if (isDonorPortal) {
    return NextResponse.next();
  }

  let session = null;
  if (token && secret) {
    session = await verifySessionForEdge(token, secret);
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isDashboardPage && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && !isAuthPage && pathname !== "/profile") {
    const forcePasswordChange = await shouldForcePasswordChange(request);
    if (forcePasswordChange) {
      return NextResponse.redirect(new URL("/profile", request.url));
    }
  }

  if (pathname === "/" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
