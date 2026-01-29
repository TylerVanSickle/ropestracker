"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  loadEntries,
  loadSettings,
  saveEntries,
  uid,
  subscribeToRopesStorage,
  LIMITS,
  clampText,
  clampInt,
  digitsOnlyMax,
} from "@/app/lib/ropesStore";

import { ensureQueueOrder } from "@/app/lib/ropesUtils";

function toLocalDatetimeValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function parseLocalDatetimeToISO(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function formatPhone(digits) {
  const d = String(digits || "")
    .replace(/\D/g, "")
    .slice(0, 10);
  if (!d) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function ReservationsPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [entries, setEntries] = useState(() => ensureQueueOrder(loadEntries()));
  const [now, setNow] = useState(() => new Date());

  const refreshFromStorage = () => {
    setSettings(loadSettings());
    setEntries(ensureQueueOrder(loadEntries()));
  };

  useEffect(() => {
    const unsub = subscribeToRopesStorage(refreshFromStorage);
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  const totalLines = clampInt(settings.totalLines ?? 10, 1, 15);

  const [form, setForm] = useState(() => {
    const in20 = new Date(Date.now() + 20 * 60 * 1000);
    return {
      name: "",
      phoneDigits: "",
      partySizeInput: "1", // ✅ string input so backspace works
      notes: "",
      reserveAtLocal: toLocalDatetimeValue(in20),
    };
  });

  const reserved = useMemo(() => {
    return entries
      .filter((e) => e.status === "RESERVED")
      .slice()
      .sort((a, b) => {
        const atA = a.reserveAtISO ? new Date(a.reserveAtISO).getTime() : 0;
        const atB = b.reserveAtISO ? new Date(b.reserveAtISO).getTime() : 0;
        return atA - atB;
      });
  }, [entries]);

  const { dueNow, upcoming } = useMemo(() => {
    const nowMs = Date.now();
    const due = [];
    const up = [];
    for (const e of reserved) {
      const at = e.reserveAtISO ? new Date(e.reserveAtISO).getTime() : 0;
      if (at && !Number.isNaN(at) && at <= nowMs) due.push(e);
      else up.push(e);
    }
    return { dueNow: due, upcoming: up };
  }, [reserved]);

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function addReservation(e) {
    e.preventDefault();

    const name = clampText(form.name, LIMITS.entryName).trim();
    if (!name) return;

    // REQUIRED phone (store digits)
    const phoneDigits = digitsOnlyMax(form.phoneDigits, LIMITS.entryPhone);
    const phone = String(phoneDigits || "")
      .replace(/\D/g, "")
      .slice(0, 10);
    if (phone.length !== 10) {
      alert("Enter a valid 10-digit phone number.");
      return;
    }

    const notes = clampText(form.notes, LIMITS.entryIntakeNotes).trim();

    // ✅ clamp party size here (not on every keystroke)
    const partySizeRaw = Number(
      String(form.partySizeInput || "").replace(/\D/g, ""),
    );
    const partySize = clampInt(partySizeRaw || 1, 1, totalLines);

    const reserveAtISO = parseLocalDatetimeToISO(form.reserveAtLocal);
    if (!reserveAtISO) {
      alert("Pick a valid reservation time.");
      return;
    }

    const newEntry = {
      id: uid(),
      name,
      phone, // stored as digits "8015551212" <- Examole
      partySize,
      linesUsed: 0,
      notes,
      status: "RESERVED",
      createdAt: new Date().toISOString(),
      queueOrder: Date.now() + Math.random(),
      reserveAtISO,
    };

    setEntries((prev) => ensureQueueOrder([...prev, newEntry]));

    const in20 = new Date(Date.now() + 20 * 60 * 1000);
    setForm({
      name: "",
      phoneDigits: "",
      partySizeInput: "1",
      notes: "",
      reserveAtLocal: toLocalDatetimeValue(in20),
    });
  }

  function deleteReservation(id) {
    const ok = confirm("Delete this reservation?");
    if (!ok) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function checkInNow(id) {
    setEntries((prev) => {
      const nowMs = Date.now();
      const next = prev.map((e) => {
        if (e.id !== id) return e;
        return {
          ...e,
          status: "WAITING",
          linesUsed: 0,
          queueOrder: nowMs - 10_000 + Math.random(),
        };
      });
      return ensureQueueOrder(next);
    });
  }

  function updateReserveTime(id, reserveAtLocal) {
    const iso = parseLocalDatetimeToISO(reserveAtLocal);
    if (!iso) return;
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, reserveAtISO: iso } : e)),
    );
  }

  const formatWhen = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <main className="container">
      <div className="card spacer-sm reservations-header">
        <div className="reservations-header__left">
          <h1 className="title" style={{ marginBottom: 6 }}>
            Reservations
          </h1>
          <p className="muted helper" style={{ margin: 0 }}>
            Add groups that should be ready at a specific time. They do not
            consume sling lines until checked in / sent up.
          </p>
        </div>

        <div className="row">
          <Link className="button" href="/">
            ← Back
          </Link>
        </div>
      </div>

      <div className="card spacer-md">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Add reservation
        </h2>

        <form className="guest-form spacer-sm" onSubmit={addReservation}>
          <div className="reservations-grid">
            <label className="field">
              <span className="field-label">Name</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="Last name / group name"
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span className="field-label">Phone</span>
              <input
                className="input"
                value={formatPhone(form.phoneDigits)}
                onChange={(e) =>
                  updateForm({
                    phoneDigits: digitsOnlyMax(
                      e.target.value,
                      LIMITS.entryPhone,
                    ),
                  })
                }
                placeholder="(801) 555-1212"
                inputMode="tel"
                autoComplete="off"
                required
              />
              <span className="muted helper reservations-mini">
                Required • stored as digits
              </span>
            </label>

            <label className="field">
              <span className="field-label">Group size</span>
              <input
                className="input"
                value={form.partySizeInput}
                onChange={(e) => {
                  const digits = String(e.target.value || "")
                    .replace(/\D/g, "")
                    .slice(0, 2); // 1–15 max anyway
                  updateForm({ partySizeInput: digits });
                }}
                onBlur={() => {
                  // snap empty -> "1" on blur so it looks clean
                  const raw = Number(
                    String(form.partySizeInput || "").replace(/\D/g, ""),
                  );
                  const n = clampInt(raw || 1, 1, totalLines);
                  updateForm({ partySizeInput: String(n) });
                }}
                inputMode="numeric"
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span className="field-label">Ready at</span>
              <input
                className="input"
                type="datetime-local"
                value={form.reserveAtLocal}
                onChange={(e) => updateForm({ reserveAtLocal: e.target.value })}
              />
              <span className="muted helper reservations-mini">
                Now:{" "}
                {now.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Notes</span>
            <textarea
              className="input"
              value={form.notes}
              onChange={(e) => updateForm({ notes: e.target.value })}
              placeholder="Any details for staff..."
              rows={3}
            />
          </label>

          <div className="row spacer-sm">
            <button className="button button-primary" type="submit">
              Add reservation
            </button>
          </div>
        </form>
      </div>

      <div className="card spacer-md">
        <div className="reservations-section-title">
          <h2 className="section-title" style={{ margin: 0 }}>
            Ready now
          </h2>
          <span className="reservations-badge">{dueNow.length}</span>
        </div>

        {dueNow.length === 0 ? (
          <p className="muted helper">No reservations are due right now.</p>
        ) : (
          <div className="reservations-list">
            {dueNow.map((e) => (
              <div className="reservations-row" key={e.id}>
                <div className="reservations-main">
                  <div className="reservations-name">
                    {e.name}{" "}
                    <span className="muted">
                      • {Math.max(1, Number(e.partySize || 1))}
                    </span>
                  </div>
                  <div className="muted helper reservations-sub">
                    Ready at {formatWhen(e.reserveAtISO)} •{" "}
                    {formatPhone(e.phone)}
                    {e.notes ? ` • ${e.notes}` : ""}
                  </div>
                </div>

                <div className="reservations-actions">
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => checkInNow(e.id)}
                    title="Move into the waiting list at the front"
                  >
                    Check in
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => deleteReservation(e.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card spacer-md">
        <div className="reservations-section-title">
          <h2 className="section-title" style={{ margin: 0 }}>
            Upcoming
          </h2>
          <span className="reservations-badge">{upcoming.length}</span>
        </div>

        {upcoming.length === 0 ? (
          <p className="muted helper">No upcoming reservations.</p>
        ) : (
          <div className="reservations-list">
            {upcoming.map((e) => {
              const localValue = e.reserveAtISO
                ? toLocalDatetimeValue(new Date(e.reserveAtISO))
                : "";

              return (
                <div className="reservations-row" key={e.id}>
                  <div className="reservations-main">
                    <div className="reservations-name">
                      {e.name}{" "}
                      <span className="muted">
                        • {Math.max(1, Number(e.partySize || 1))}
                      </span>
                    </div>

                    <div className="reservations-inline">
                      <span className="muted helper">Ready at</span>
                      <input
                        className="input reservations-dt"
                        type="datetime-local"
                        value={localValue}
                        onChange={(ev) =>
                          updateReserveTime(e.id, ev.target.value)
                        }
                      />
                      <span className="muted helper reservations-when">
                        ({formatWhen(e.reserveAtISO)})
                      </span>
                    </div>

                    <div className="muted helper reservations-sub">
                      {formatPhone(e.phone)}
                      {e.notes ? ` • ${e.notes}` : ""}
                    </div>
                  </div>

                  <div className="reservations-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => deleteReservation(e.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="muted helper" style={{ marginTop: 12 }}>
        Tip: When the “ready at” time arrives, your Home page effect will
        automatically move those reservations into the waiting list.
      </p>
    </main>
  );
}
