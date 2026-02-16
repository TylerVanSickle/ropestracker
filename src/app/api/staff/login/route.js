// src/app/api/staff/login/route.js
import { NextResponse } from "next/server";
import {
  makeStaffCookieValue,
  STAFF_COOKIE_NAME,
  STAFF_COOKIE_MAX_AGE,
} from "@/app/lib/staffWallAuth";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || "");

  const expected = process.env.STAFF_WALL_PASSWORD || "";
  const secret = process.env.STAFF_WALL_COOKIE_SECRET || "";

  if (!expected || !secret) {
    return NextResponse.json(
      { ok: false, error: "Missing STAFF_WALL env vars" },
      { status: 500 },
    );
  }

  if (password !== expected) {
    return NextResponse.json(
      { ok: false, error: "Invalid password" },
      { status: 401 },
    );
  }

  const cookieValue = await makeStaffCookieValue(secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: STAFF_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_COOKIE_MAX_AGE,
  });
  return res;
}
