// src/middleware.js
import { NextResponse } from "next/server";
import {
  verifyStaffCookieValue,
  STAFF_COOKIE_NAME,
} from "@/app/lib/staffWallAuth";

function isPublic(pathname) {
  // allow Next internals + static
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;

  //   ONLY guest-visible page:
  if (pathname === "/client" || pathname.startsWith("/client/")) return true;

  // staff login
  if (pathname === "/staff/login") return true;
  if (pathname === "/api/staff/login") return true;

  return false;
}

export async function middleware(req) {
  const { pathname, search } = req.nextUrl;

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
