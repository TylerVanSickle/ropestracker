"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  bucketReservations,
  eventTypeEmoji,
  fmtReservationTime,
} from "@/app/lib/reservations";

const REFRESH_MS = 60 * 1000;

export default function ReservationsBanner() {
  const [reservations, setReservations] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchReservations() {
      try {
        const res = await fetch("/api/reservations?status=PENDING", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.ok) {
          setReservations(
            Array.isArray(data.reservations) ? data.reservations : [],
          );
        }
      } catch {
        // silent — banner is optional
      }
    }

    // Defer the initial fetch out of the effect body so we don't trigger
    // a cascading render synchronously after mount.
    const initial = setTimeout(fetchReservations, 0);
    const interval = setInterval(() => {
      if (cancelled) return;
      setNow(new Date());
      fetchReservations();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const buckets = bucketReservations(reservations, now);
  const todayCount = buckets.today.length;
  const weekCount = buckets.thisWeek.length;
  const total = todayCount + weekCount;

  if (total === 0) return null;

  return (
    <div
      className="card spacer-sm"
      style={{
        padding: 0,
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid rgba(59, 130, 246, 0.4)",
        background: "rgba(59, 130, 246, 0.06)",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            fontSize: 14,
          }}
        >
          <span style={{ fontWeight: 700, color: "#1d4ed8" }}>
            Reservations
          </span>
          {todayCount > 0 ? (
            <span style={{ fontWeight: 600 }}>
              <strong>{todayCount}</strong> today
            </span>
          ) : null}
          {weekCount > 0 ? (
            <span className="muted">
              · {weekCount} this week
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="button"
            onClick={() => setExpanded((v) => !v)}
            style={{ fontSize: 12, padding: "4px 10px", minHeight: 0 }}
          >
            {expanded ? "Hide" : "Show"}
          </button>
          <Link
            className="button"
            href="/reservations"
            style={{ fontSize: 12, padding: "4px 10px", minHeight: 0 }}
          >
            Manage
          </Link>
        </div>
      </div>

      {/* Expanded list */}
      {expanded ? (
        <div style={{ padding: "0 14px 12px" }}>
          {todayCount > 0 ? (
            <div style={{ marginTop: 4 }}>
              <div
                className="muted"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Today
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                {buckets.today.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: "8px 10px",
                      background: "var(--color-card)",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      fontSize: 13,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700 }}>
                        {eventTypeEmoji(r.event_type)} {r.name}
                      </span>{" "}
                      <span className="muted">
                        — {r.party_size}{" "}
                        {r.party_size === 1 ? "person" : "people"}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      ⏰ {fmtReservationTime(r.reserved_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {weekCount > 0 ? (
            <div style={{ marginTop: todayCount > 0 ? 12 : 4 }}>
              <div
                className="muted"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                This week
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                {buckets.thisWeek.slice(0, 8).map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: "8px 10px",
                      background: "var(--color-card)",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      fontSize: 13,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700 }}>
                        {eventTypeEmoji(r.event_type)} {r.name}
                      </span>{" "}
                      <span className="muted">
                        — {r.party_size}{" "}
                        {r.party_size === 1 ? "person" : "people"}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {" "}
                      {new Date(r.reserved_at).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {fmtReservationTime(r.reserved_at)}
                    </div>
                  </div>
                ))}
                {weekCount > 8 ? (
                  <Link
                    href="/reservations"
                    style={{
                      fontSize: 12,
                      color: "var(--color-muted)",
                      textAlign: "center",
                      padding: 4,
                    }}
                  >
                    +{weekCount - 8} more — view all
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
