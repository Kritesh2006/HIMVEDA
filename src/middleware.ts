import { NextResponse, type NextRequest } from "next/server";

const COOKIE_GEO = "hv_geo";
const SESSION_COOKIES = ["__Host-hv_session", "hv_session"];

/** Read the platform's geolocation header. Configurable so self-hosting never trusts a spoofable header by accident. */
function edgeCountry(req: NextRequest): string | null {
  const source = process.env.GEO_HEADER_SOURCE ?? "vercel";
  const raw =
    source === "vercel"
      ? req.headers.get("x-vercel-ip-country")
      : source === "cloudflare"
        ? req.headers.get("cf-ipcountry")
        : null;
  const c = raw?.toUpperCase();
  return c && /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Studio: cheap gate on cookie presence. Real authorisation happens server-side on every request.
  if (pathname.startsWith("/studio")) {
    const has = SESSION_COOKIES.some((n) => req.cookies.get(n)?.value);
    if (!has) return NextResponse.redirect(new URL("/owner", req.url));
  }

  const country = edgeCountry(req);
  const current = req.cookies.get(COOKIE_GEO)?.value;
  if (country && current !== `${country}:edge`) {
    const headers = new Headers(req.headers);
    headers.set("x-himveda-country", country);
    const res = NextResponse.next({ request: { headers } });
    res.cookies.set(COOKIE_GEO, `${country}:edge`, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", httpOnly: false });
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/media|api/health|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"],
};
