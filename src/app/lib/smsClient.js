//smsClient.js
//Client fetch helper
export async function sendSms({ to, message }) {
  const res = await fetch("/api/sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, message }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "SMS failed");
  }
  return data; // { ok: true, sid }
}
