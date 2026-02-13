"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Avoid static prerender/export issues for a login page
export const dynamic = "force-dynamic";

function StaffLoginInner() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Login failed");

      router.replace(next);
      router.refresh();
    } catch (e) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Staff Login</h1>
      <p style={{ opacity: 0.75, marginTop: 0, marginBottom: 16 }}>
        Enter staff password to access Ropes Tracker.
      </p>

      <form onSubmit={onSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #333",
          }}
        />

        {err ? (
          <div style={{ color: "#ff6b6b", marginTop: 10 }}>{err}</div>
        ) : null}

        <button
          type="submit"
          disabled={!password || loading}
          style={{
            width: "100%",
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #333",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
          Loading…
        </div>
      }
    >
      <StaffLoginInner />
    </Suspense>
  );
}
