"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfirmModal from "@/app/components/ropes/ConfirmModal";
import AddReservationForm from "./AddReservationForm";
import EditReservationModal from "./EditReservationModal";
import {
  EVENT_TYPES,
  eventTypeLabel,
  fmtReservationDate,
  fmtReservationTime,
  bucketReservations,
  formatPhoneUS,
} from "@/app/lib/reservations";

const STATUS_COLORS = {
  PENDING: { bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.4)", color: "#1d4ed8" },
  CHECKED_IN: { bg: "rgba(34, 197, 94, 0.12)", border: "rgba(34, 197, 94, 0.4)", color: "#15803d" },
  CANCELLED: { bg: "rgba(107, 114, 128, 0.12)", border: "rgba(107, 114, 128, 0.4)", color: "#374151" },
  NO_SHOW: { bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.4)", color: "#b91c1c" },
  COMPLETED: { bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.4)", color: "#7e22ce" },
};

function StatusPill({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 10,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {String(status || "").replace("_", " ")}
    </span>
  );
}

function ReservationCard({ r, onCheckIn, onCancel, onDelete, onEdit }) {
  const isPending = r.status === "PENDING";
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        background: "var(--color-card)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800 }}>{r.name}</span>
            <span className="pill">
              {r.party_size} {r.party_size === 1 ? "person" : "people"}
            </span>
            <span className="pill">{eventTypeLabel(r.event_type)}</span>
            <StatusPill status={r.status} />
          </div>

          <div
            className="muted"
            style={{
              fontSize: 13,
              marginTop: 6,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <span>
              <strong style={{ color: "var(--color-text)" }}>
                {fmtReservationDate(r.reserved_at)}
              </strong>{" "}
              at{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {fmtReservationTime(r.reserved_at)}
              </strong>
            </span>
            {r.phone ? (
              <a
                href={`tel:${r.phone.replace(/\D/g, "")}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {formatPhoneUS(r.phone)}
              </a>
            ) : null}
          </div>

          {r.notes ? (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                background: "var(--color-bg)",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {r.notes}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {isPending && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => onCheckIn(r)}
              style={{ fontSize: 13, padding: "6px 12px" }}
            >
              Check in
            </button>
          )}
          <button
            className="button"
            type="button"
            onClick={() => onEdit(r)}
            style={{ fontSize: 13, padding: "6px 12px" }}
          >
            Edit
          </button>
          {isPending && (
            <button
              className="button"
              type="button"
              onClick={() => onCancel(r)}
              style={{ fontSize: 13, padding: "6px 12px" }}
            >
              Cancel
            </button>
          )}
          <button
            className="button"
            type="button"
            onClick={() => onDelete(r)}
            style={{
              fontSize: 13,
              padding: "6px 12px",
              color: "var(--danger, #b91c1c)",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, children, accentColor }) {
  return (
    <section className="card spacer-md" style={{ padding: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {accentColor ? (
          <div
            style={{
              width: 4,
              height: 20,
              background: accentColor,
              borderRadius: 4,
            }}
          />
        ) : null}
        <h2 className="section-title" style={{ margin: 0, fontSize: 18 }}>
          {title}
        </h2>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 10,
            background: "var(--color-bg)",
            color: "var(--color-muted)",
          }}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => new Date());

  // Modals
  const [editTarget, setEditTarget] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState("ALL");
  const [showStatus, setShowStatus] = useState({
    PENDING: true,
    CHECKED_IN: false,
    CANCELLED: false,
    NO_SHOW: false,
    COMPLETED: false,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/reservations", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load reservations");
      }
      setReservations(Array.isArray(data.reservations) ? data.reservations : []);
    } catch (e) {
      setErr(e?.message || "Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Returns true on success so the form can clear itself.
  async function handleCreate(payload) {
    setSaving(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Save failed");
      }
      await load();
      return true;
    } catch (e) {
      alert(e?.message || "Failed to create reservation");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(payload) {
    if (!editTarget?.id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: editTarget.id, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Save failed");
      }
      setEditTarget(null);
      await load();
    } catch (e) {
      alert(e?.message || "Failed to update reservation");
    } finally {
      setSaving(false);
    }
  }

  function askCancel(r) {
    setConfirm({
      type: "CANCEL",
      reservation: r,
      title: "Cancel reservation?",
      message: `Mark ${r.name}'s reservation as cancelled? You can still see it under the CANCELLED filter.`,
      confirmText: "Cancel reservation",
      tone: "danger",
    });
  }

  function askDelete(r) {
    setConfirm({
      type: "DELETE",
      reservation: r,
      title: "Delete reservation?",
      message: `Permanently delete ${r.name}'s reservation? This cannot be undone.`,
      confirmText: "Delete forever",
      tone: "danger",
    });
  }

  function askCheckIn(r) {
    const peopleLabel = `${r.party_size} ${r.party_size === 1 ? "person" : "people"}`;
    setConfirm({
      type: "CHECKIN",
      reservation: r,
      title: "Check in?",
      message: `Add ${r.name} (${peopleLabel}) to the live waitlist?`,
      confirmText: "Check in",
      tone: "primary",
    });
  }

  async function runConfirm() {
    if (!confirm?.reservation) return;
    const r = confirm.reservation;
    const type = confirm.type;
    setConfirm(null);

    try {
      if (type === "CANCEL") {
        const res = await fetch("/api/reservations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: r.id, status: "CANCELLED" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Cancel failed");
      } else if (type === "DELETE") {
        const res = await fetch(
          `/api/reservations?id=${encodeURIComponent(r.id)}`,
          { method: "DELETE", credentials: "include" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Delete failed");
      } else if (type === "CHECKIN") {
        const createRes = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            op: "CREATE_ENTRY",
            payload: {
              name: r.name,
              party_size: r.party_size,
              lines_used: r.party_size,
              phone: r.phone || null,
              notes: r.notes || null,
              status: "WAITING",
            },
          }),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok || !createData?.ok) {
          throw new Error(createData?.error || "Failed to create entry");
        }
        const entryId = createData?.entry?.id || null;

        await fetch("/api/reservations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: r.id,
            status: "CHECKED_IN",
            linked_entry_id: entryId,
          }),
        });
      }

      await load();
    } catch (e) {
      alert(e?.message || "Action failed");
    }
  }

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (filterType !== "ALL" && r.event_type !== filterType) return false;
      if (!showStatus[r.status]) return false;
      return true;
    });
  }, [reservations, filterType, showStatus]);

  const buckets = useMemo(() => bucketReservations(filtered, now), [filtered, now]);
  const totalPending = reservations.filter((r) => r.status === "PENDING").length;

  return (
    <main className="container">
      {/* Header */}
      <div className="topbar">
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Reservations</h1>
            <div className="muted" style={{ fontSize: 13 }}>
              {totalPending} pending · pre-book groups for any date and check
              them in when they arrive.
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link className="button" href="/">
              Bottom
            </Link>
            <Link className="button" href="/top">
              Top
            </Link>
          </div>
        </div>
      </div>

      {/* Inline Add form */}
      <AddReservationForm onCreate={handleCreate} saving={saving} />

      {/* Filters */}
      <section className="card spacer-md" style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <label className="muted" style={{ fontSize: 13 }}>
              Type:
            </label>
            <select
              className="input"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: "auto", padding: "6px 10px" }}
            >
              <option value="ALL">All types</option>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span className="muted" style={{ fontSize: 13 }}>
              Show:
            </span>
            {Object.keys(showStatus).map((s) => (
              <label
                key={s}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={showStatus[s]}
                  onChange={(e) =>
                    setShowStatus((p) => ({ ...p, [s]: e.target.checked }))
                  }
                />
                {s.replace("_", " ")}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Loading / Error / Lists */}
      {loading ? (
        <div
          className="card spacer-md"
          style={{ padding: 20, textAlign: "center" }}
        >
          <div className="muted">Loading reservations…</div>
        </div>
      ) : err ? (
        <div
          className="card spacer-md"
          style={{
            padding: 14,
            background: "var(--danger-bg)",
            color: "var(--danger)",
          }}
        >
          {err}
        </div>
      ) : (
        <>
          <Section
            title="Today"
            count={buckets.today.length}
            accentColor="var(--color-primary)"
          >
            {buckets.today.length === 0 ? (
              <div className="muted" style={{ padding: 12, fontSize: 13 }}>
                No reservations for today.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {buckets.today.map((r) => (
                  <ReservationCard
                    key={r.id}
                    r={r}
                    onCheckIn={askCheckIn}
                    onCancel={askCancel}
                    onDelete={askDelete}
                    onEdit={setEditTarget}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="This week" count={buckets.thisWeek.length}>
            {buckets.thisWeek.length === 0 ? (
              <div className="muted" style={{ padding: 12, fontSize: 13 }}>
                No upcoming reservations in the next 7 days.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {buckets.thisWeek.map((r) => (
                  <ReservationCard
                    key={r.id}
                    r={r}
                    onCheckIn={askCheckIn}
                    onCancel={askCancel}
                    onDelete={askDelete}
                    onEdit={setEditTarget}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Future" count={buckets.future.length}>
            {buckets.future.length === 0 ? (
              <div className="muted" style={{ padding: 12, fontSize: 13 }}>
                No future reservations.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {buckets.future.map((r) => (
                  <ReservationCard
                    key={r.id}
                    r={r}
                    onCheckIn={askCheckIn}
                    onCancel={askCancel}
                    onDelete={askDelete}
                    onEdit={setEditTarget}
                  />
                ))}
              </div>
            )}
          </Section>

          {buckets.past.length > 0 ? (
            <Section
              title="Past"
              count={buckets.past.length}
              accentColor="var(--color-muted)"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {buckets.past.map((r) => (
                  <ReservationCard
                    key={r.id}
                    r={r}
                    onCheckIn={askCheckIn}
                    onCancel={askCancel}
                    onDelete={askDelete}
                    onEdit={setEditTarget}
                  />
                ))}
              </div>
            </Section>
          ) : null}
        </>
      )}

      {/* Edit modal */}
      <EditReservationModal
        reservation={editTarget}
        saving={saving}
        onSave={handleUpdate}
        onClose={() => setEditTarget(null)}
      />

      {/* Confirm modal */}
      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title || "Confirm"}
        message={confirm?.message}
        confirmText={confirm?.confirmText || "Confirm"}
        tone={confirm?.tone || "danger"}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </main>
  );
}
