// src/app/lib/staffWallAuth.js
export const STAFF_COOKIE_NAME =
  process.env.STAFF_WALL_COOKIE_NAME || "staff_auth";
export const STAFF_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function base64urlEncode(bytes) {
  const bin = String.fromCharCode(...bytes);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecodeToBytes(b64url) {
  const b64 =
    b64url.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacSign(payload, secret) {
  const key = await importHmacKey(secret);
  const enc = new TextEncoder();
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return base64urlEncode(new Uint8Array(sigBuf));
}

async function hmacVerify(payload, sigB64Url, secret) {
  const key = await importHmacKey(secret);
  const enc = new TextEncoder();
  const sigBytes = base64urlDecodeToBytes(sigB64Url);
  return crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payload));
}

// cookie value format: v1.<exp>.<sigB64Url>
export async function makeStaffCookieValue(secret) {
  const exp = Math.floor(Date.now() / 1000) + STAFF_COOKIE_MAX_AGE;
  const payload = `v1.${exp}`;
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyStaffCookieValue(value, secret) {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [v, expStr, sig] = parts;
  if (v !== "v1") return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;

  const payload = `${v}.${expStr}`;
  return hmacVerify(payload, sig, secret);
}
