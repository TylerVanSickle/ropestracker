//ropestracker/src/app/api/sms/route.js
// TWILLIO SERVER ROUTE THING

import twilio from "twilio";

function toE164US(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return null;
}

export async function POST(req) {
  try {
    const { to, message } = await req.json();

    const toE164 = toE164US(to);
    if (!toE164) {
      return Response.json(
        { ok: false, error: "Invalid phone number." },
        { status: 400 },
      );
    }

    const body = String(message || "").trim();
    if (!body) {
      return Response.json(
        { ok: false, error: "Message is required." },
        { status: 400 },
      );
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } =
      process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return Response.json(
        { ok: false, error: "Twilio env vars missing." },
        { status: 500 },
      );
    }

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    const result = await client.messages.create({
      to: toE164,
      from: TWILIO_PHONE_NUMBER,
      body,
    });

    return Response.json({ ok: true, sid: result.sid });
  } catch (err) {
    return Response.json(
      { ok: false, error: err?.message || "Failed to send SMS." },
      { status: 500 },
    );
  }
}
