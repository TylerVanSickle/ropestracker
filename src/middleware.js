// src/middleware.js
import { NextResponse } from "next/server";
import {
  verifyStaffCookieValue,
  STAFF_COOKIE_NAME,
} from "@/app/lib/staffWallAuth";

// Common public static files and metadata endpoints
function isPublicAsset(pathname) {
  if (pathname.startsWith("/_next")) return true;

  // Common Next/static files
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (pathname === "/site.webmanifest") return true;
  if (pathname === "/manifest.json") return true;

  // Apple / PWA icons commonly requested
  if (pathname === "/apple-touch-icon.png") return true;
  if (pathname === "/apple-touch-icon-precomposed.png") return true;

  // Your custom icons ( mentioned /icon.svg)
  if (pathname === "/icon.svg") return true;

  // Any file request with an extension should be public (images/fonts/etc.)
  // Prevents /staff/login?next=/whatever.png loops
  const last = pathname.split("/").pop() || "";
  if (last.includes(".")) return true;

  return false;
}

function isPublic(pathname) {
  // Allow Next internals + static assets
  if (isPublicAsset(pathname)) return true;

  // ONLY guest-visible pages:
  if (pathname === "/client" || pathname.startsWith("/client/")) return true;

  // staff login endpoints
  if (pathname === "/staff/login") return true;
  if (pathname === "/api/staff/login") return true;

  return false;
}

export async function middleware(req) {
  const { pathname, search } = req.nextUrl;

  // Let HEAD/OPTIONS through (avoids odd redirects on preflight or health checks)
  if (req.method === "HEAD" || req.method === "OPTIONS") {
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  const secret = process.env.STAFF_WALL_COOKIE_SECRET || "";
  if (!secret) return NextResponse.next(); // dev fallback

  const cookie = req.cookies.get(STAFF_COOKIE_NAME)?.value;
  const ok = await verifyStaffCookieValue(cookie, secret);

  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/staff/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
