"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadSettings,
  MAX_SLING_LINES,
  LIMITS,
  clampText,
  clampInt,
} from "@/app/lib/ropesStore";

/* Phone formatter (US) */
function formatPhoneUS(input) {
  if (!input) return "";

  // Strip non-digits
  let digits = input.replace(/\D/g, "");

  // Handle leading US country code
  if (digits.length > 10 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  // Cap at 10 digits
  digits = digits.slice(0, 10);

  const len = digits.length;

  if (len === 0) return "";
  if (len < 4) return digits;
  if (len < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function fmtArchiveDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

export default function AddGuestForm({
  newGuest,
  setNewGuest,
  onAddGuest,
  overdriveMax,
}) {
  // Pull current settings so we can clamp party size to totalLines
  const maxLines = useMemo(() => {
    const s = loadSettings();
    const n = Number(s?.totalLines ?? MAX_SLING_LINES);
    const base = Number.isFinite(n) ? Math.max(1, n) : MAX_SLING_LINES;
    return overdriveMax != null
      ? Math.min(20, Math.max(base, overdriveMax))
      : base;
  }, [overdriveMax]);

  // Phone-match state
  const [matches, setMatches] = useState([]);
  const [checking, setChecking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const lastQueriedPhoneRef = useRef("");
  const abortRef = useRef(null);

  const phoneDigits = digitsOnly(newGuest.phone);
  const isComplete10 = phoneDigits.length === 10;

  // Debounced fetch when phone has 10 digits
  useEffect(() => {
    // Clear matches when phone is incomplete
    if (!isComplete10) {
      setMatches([]);
      setChecking(false);
      lastQueriedPhoneRef.current = "";
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      return;
    }

    // Avoid re-querying the same number repeatedly
    if (lastQueriedPhoneRef.current === phoneDigits) return;

    let cancelled = false;
    const controller = new AbortController();
    abortRef.current = controller;

    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/archive?phone=${encodeURIComponent(phoneDigits)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const records = Array.isArray(data?.records) ? data.records : [];
        setMatches(records);
        lastQueriedPhoneRef.current = phoneDigits;
      } catch (e) {
        if (e?.name !== "AbortError") {
          // silent fail — don't block guest add over a network blip
          setMatches([]);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [phoneDigits, isComplete10]);

  const matchCount = matches.length;
  const escalated = matchCount >= 2;

  function handleSubmit(e) {
    e.preventDefault();
    if (matchCount > 0) {
      setConfirmOpen(true);
    } else {
      onAddGuest(e);
    }
  }

  function handleConfirmAdd() {
    setConfirmOpen(false);
    // Call the parent's add handler directly (no real form event needed)
    onAddGuest({ preventDefault: () => {} });
  }

  // Banner styling
  const bannerStyle = matchCount === 0
    ? null
    : escalated
      ? {
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.5)",
          color: "var(--danger, #b91c1c)",
        }
      : {
          background: "rgba(245, 158, 11, 0.12)",
          border: "1px solid rgba(245, 158, 11, 0.5)",
          color: "#92400e",
        };

  return (
    <div className="card spacer-md">
      <div className="card-header">
        <div>
          <h2 className="section-title">Add Guest</h2>
          <p className="muted helper">
            Add them to the line. You can edit them later.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="guest-form spacer-sm">
        <div className="form-row">
          <label className="field">
            <span className="field-label">Name / Group</span>
            <input
              className="input"
              value={newGuest.name}
              maxLength={LIMITS.entryName}
              onChange={(e) =>
                setNewGuest((g) => ({
                  ...g,
                  name: clampText(e.target.value, LIMITS.entryName),
                }))
              }
              placeholder="e.g., Smith Family"
              autoComplete="off"
            />
            <span className="muted helper">
              {String(newGuest.name ?? "").length}/{LIMITS.entryName}
            </span>
          </label>

          <label className="field">
            <span className="field-label">Party size</span>
            <input
              className="input"
              type="number"
              min={1}
              max={maxLines}
              value={newGuest.partySize}
              onChange={(e) => {
                const raw = e.target.value;

                if (raw === "") {
                  setNewGuest((g) => ({ ...g, partySize: "" }));
                  return;
                }

                const n = Number(raw);
                if (!Number.isFinite(n)) return;

                setNewGuest((g) => ({
                  ...g,
                  partySize: clampInt(n, 1, maxLines),
                }));
              }}
              onBlur={() => {
                setNewGuest((g) => {
                  const current = g.partySize;

                  if (
                    current === "" ||
                    !Number.isFinite(Number(current)) ||
                    Number(current) < 1
                  ) {
                    return { ...g, partySize: 1 };
                  }

                  return {
                    ...g,
                    partySize: clampInt(current, 1, maxLines),
                  };
                });
              }}
            />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span className="field-label">Phone</span>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={newGuest.phone}
              required
              placeholder="(801) 555-1234"
              onChange={(e) => {
                const formatted = formatPhoneUS(e.target.value);
                setNewGuest((g) => ({
                  ...g,
                  phone: formatted,
                }));
              }}
            />
            <span className="muted helper">
              {checking
                ? "Checking archive…"
                : "Formatted automatically"}
            </span>
          </label>

          <label className="field">
            <span className="field-label">Notes (optional)</span>
            <input
              className="input"
              value={newGuest.notes}
              maxLength={LIMITS.entryIntakeNotes}
              onChange={(e) =>
                setNewGuest((g) => ({
                  ...g,
                  notes: clampText(e.target.value, LIMITS.entryIntakeNotes),
                }))
              }
              placeholder="birthday, call at 3:10, etc."
              autoComplete="off"
            />
            <span className="muted helper">
              {String(newGuest.notes ?? "").length}/{LIMITS.entryIntakeNotes}
            </span>
          </label>
        </div>

        {/* Inline phone-match banner */}
        {matchCount > 0 && (
          <div
            style={{
              ...bannerStyle,
              padding: "10px 14px",
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {escalated ? "🚨" : "⚠️"} This phone matches{" "}
              {matchCount} prior archive{matchCount === 1 ? "" : "s"}
              {escalated ? " — repeat offender" : ""}
            </div>
            <div style={{ fontSize: 13 }}>
              Most recent: <strong>{matches[0]?.reason || "—"}</strong>
              {matches[0]?.archived_at
                ? ` (${fmtArchiveDate(matches[0].archived_at)})`
                : ""}
              {" • "}
              <a
                href={`/archive?phone=${encodeURIComponent(phoneDigits)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                View all
              </a>
            </div>
          </div>
        )}

        <button className="button button-primary button-wide" type="submit">
          Add to waitlist
        </button>
      </form>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 9999,
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="card"
            style={{ width: "min(560px, 100%)", padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: escalated ? "var(--danger, #b91c1c)" : "#92400e",
              }}
            >
              {escalated ? "🚨 Repeat offender" : "⚠️ Prior archive on file"}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              This phone has been archived {matchCount} time
              {matchCount === 1 ? "" : "s"} before. Review before adding.
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: "min(360px, 50vh)",
                overflowY: "auto",
              }}
            >
              {matches.map((r) => {
                const e = r?.entry_snapshot || {};
                return (
                  <div
                    key={r.id}
                    className="item"
                    style={{ padding: 10, borderRadius: 10 }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {e.name || "Unknown"}{" "}
                      <span className="muted" style={{ fontWeight: 400 }}>
                        — group of {e.partySize || "?"}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {fmtArchiveDate(r.archived_at)} • By:{" "}
                      <strong>{r.archived_by || "?"}</strong>
                    </div>
                    {r.reason ? (
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        <span className="muted">Reason: </span>
                        <strong>{r.reason}</strong>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div
              className="row"
              style={{
                gap: 10,
                marginTop: 16,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <a
                className="button"
                href={`/archive?phone=${encodeURIComponent(phoneDigits)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Archive
              </a>
              <button
                className="button"
                type="button"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={handleConfirmAdd}
              >
                Add anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
