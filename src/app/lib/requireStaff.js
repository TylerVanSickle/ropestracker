// src/app/lib/requireStaff.js
import { cookies } from "next/headers";
import { verifyStaffCookieValue } from "@/app/lib/staffWallAuth";

export const STAFF_COOKIE_NAME =
  process.env.STAFF_WALL_COOKIE_NAME || "rt_staff"; 
const STAFF_COOKIE_SECRET = process.env.STAFF_WALL_COOKIE_SECRET;

export async function requireStaffOrThrow() {
  if (!STAFF_COOKIE_SECRET) {
    const err = new Error("Missing STAFF_WALL_COOKIE_SECRET");
    err.status = 500;
    throw err;
  }

  const jar = await cookies(); // ✅ Next 16: cookies() is async in route handlers
  const v = jar.get(STAFF_COOKIE_NAME)?.value;

  const ok = await verifyStaffCookieValue(v, STAFF_COOKIE_SECRET);
  if (!ok) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  return true;
}
