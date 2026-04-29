"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const POPOVER_WIDTH = 340;
const VIEWPORT_MARGIN = 12;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Build a 6-row calendar grid (42 cells) starting from the Sunday of the first week
function buildCalendarGrid(viewMonth) {
  const first = startOfMonth(viewMonth);
  const startWeekday = first.getDay(); // 0 = Sun
  const grid = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() - startWeekday + i);
    grid.push(d);
  }
  return grid;
}

function formatDisplay(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function to12Hour(date) {
  const h24 = date.getHours();
  const m = date.getMinutes();
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h12, m, period };
}

function from12Hour(h12, m, period) {
  let h24 = h12 % 12;
  if (period === "PM") h24 += 12;
  return { h: h24, m };
}

export default function DateTimePicker({
  value, // Date | ISO string | null
  onChange,
  placeholder = "Pick date & time",
  required = false,
  minuteStep = 5,
  className = "",
}) {
  const valueDate = useMemo(() => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(valueDate || new Date()),
  );
  const [pos, setPos] = useState({ top: 0, left: 0, width: POPOVER_WIDTH });

  const wrapRef = useRef(null);
  const popRef = useRef(null);

  // Reset month view when value changes externally / popover opens
  useEffect(() => {
    if (open && valueDate) {
      setViewMonth(startOfMonth(valueDate));
    }
  }, [open, valueDate]);

  // Outside click + Esc to close
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        popRef.current &&
        !popRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Smart positioning of the popover relative to the trigger
  useLayoutEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;

    const recalc = () => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(POPOVER_WIDTH, vw - VIEWPORT_MARGIN * 2);

      let left = rect.left;
      if (left + width + VIEWPORT_MARGIN > vw) {
        left = vw - width - VIEWPORT_MARGIN;
      }
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

      // Prefer below; flip to above if not enough room
      let top = rect.bottom + 6;
      const popH = popRef.current?.offsetHeight || 360;
      if (top + popH + VIEWPORT_MARGIN > vh) {
        const aboveTop = rect.top - 6 - popH;
        if (aboveTop > VIEWPORT_MARGIN) top = aboveTop;
      }

      setPos({ top, left, width });
    };

    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [open]);

  const grid = useMemo(() => buildCalendarGrid(viewMonth), [viewMonth]);
  const today = useMemo(() => new Date(), []);

  const time = valueDate ? to12Hour(valueDate) : { h12: 12, m: 0, period: "PM" };

  function commit(d) {
    if (typeof onChange === "function") onChange(d);
  }

  function handleDayClick(day) {
    const next = valueDate ? new Date(valueDate) : new Date();
    next.setFullYear(day.getFullYear());
    next.setMonth(day.getMonth());
    next.setDate(day.getDate());
    if (!valueDate) {
      // Default time = next round half hour
      const now = new Date();
      next.setHours(now.getHours());
      next.setMinutes(now.getMinutes() < 30 ? 30 : 0);
      if (now.getMinutes() >= 30) next.setHours(now.getHours() + 1);
      next.setSeconds(0, 0);
    }
    commit(next);
  }

  function nudgeHour(delta) {
    const base = valueDate || new Date();
    const next = new Date(base);
    next.setHours(next.getHours() + delta);
    commit(next);
  }

  function nudgeMinute(delta) {
    const base = valueDate || new Date();
    const next = new Date(base);
    next.setMinutes(next.getMinutes() + delta);
    commit(next);
  }

  function setHour12(h12) {
    const base = valueDate || new Date();
    const next = new Date(base);
    const period = base.getHours() >= 12 ? "PM" : "AM";
    const { h } = from12Hour(h12, base.getMinutes(), period);
    next.setHours(h);
    commit(next);
  }

  function setMinute(m) {
    const base = valueDate || new Date();
    const next = new Date(base);
    next.setMinutes(m);
    commit(next);
  }

  function setPeriod(period) {
    const base = valueDate || new Date();
    const cur = to12Hour(base);
    const { h } = from12Hour(cur.h12, cur.m, period);
    const next = new Date(base);
    next.setHours(h);
    commit(next);
  }

  return (
    <div className={className} style={{ position: "relative" }}>
      <button
        ref={wrapRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input"
        style={{
          width: "100%",
          padding: 10,
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "var(--color-card)",
          color: valueDate ? "var(--color-text)" : "var(--color-muted)",
          fontWeight: valueDate ? 600 : 400,
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{valueDate ? formatDisplay(valueDate) : placeholder}</span>
        <span style={{ fontSize: 14, opacity: 0.6 }}>📅</span>
      </button>

      {/* Hidden field so HTML5 required validation works in forms */}
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={valueDate ? valueDate.toISOString() : ""}
          onChange={() => {}}
          style={{
            opacity: 0,
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            height: 1,
            width: 1,
          }}
        />
      ) : null}

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-modal="false"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 1000,
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 14,
            boxShadow: "var(--shadow-md)",
            padding: 12,
          }}
        >
          {/* Month header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 10px",
                borderRadius: 8,
              }}
              aria-label="Previous month"
            >
              ◀
            </button>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 10px",
                borderRadius: 8,
              }}
              aria-label="Next month"
            >
              ▶
            </button>
          </div>

          {/* Day-of-week header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
              marginBottom: 4,
            }}
          >
            {DAYS.map((d, i) => (
              <div
                key={i}
                className="muted"
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: 4,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
            }}
          >
            {grid.map((day) => {
              const isOtherMonth = day.getMonth() !== viewMonth.getMonth();
              const isSelected = sameDay(day, valueDate);
              const isToday = sameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  style={{
                    padding: "8px 0",
                    borderRadius: 8,
                    border: isToday
                      ? "1px solid var(--color-primary)"
                      : "1px solid transparent",
                    background: isSelected
                      ? "var(--color-primary)"
                      : "transparent",
                    color: isSelected
                      ? "var(--color-primary-text)"
                      : isOtherMonth
                        ? "var(--color-muted)"
                        : "var(--color-text)",
                    fontWeight: isSelected || isToday ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    opacity: isOtherMonth ? 0.4 : 1,
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time selector */}
          <div
            style={{
              marginTop: 14,
              padding: 10,
              background: "var(--color-bg)",
              borderRadius: 10,
              border: "1px solid var(--color-border)",
            }}
          >
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
              Time
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
              }}
            >
              {/* Hour stepper */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => nudgeHour(1)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 14,
                    cursor: "pointer",
                    padding: 2,
                    color: "var(--color-muted)",
                  }}
                >
                  ▲
                </button>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={time.h12}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                    setHour12(n);
                  }}
                  style={{
                    width: 48,
                    fontSize: 22,
                    fontWeight: 800,
                    textAlign: "center",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    padding: "4px 0",
                    background: "var(--color-card)",
                    color: "var(--color-text)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => nudgeHour(-1)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 14,
                    cursor: "pointer",
                    padding: 2,
                    color: "var(--color-muted)",
                  }}
                >
                  ▼
                </button>
              </div>

              <div style={{ fontSize: 22, fontWeight: 800, marginTop: -2 }}>
                :
              </div>

              {/* Minute stepper */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => nudgeMinute(minuteStep)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 14,
                    cursor: "pointer",
                    padding: 2,
                    color: "var(--color-muted)",
                  }}
                >
                  ▲
                </button>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={minuteStep}
                  value={pad2(time.m)}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                    setMinute(n);
                  }}
                  style={{
                    width: 48,
                    fontSize: 22,
                    fontWeight: 800,
                    textAlign: "center",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    padding: "4px 0",
                    background: "var(--color-card)",
                    color: "var(--color-text)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => nudgeMinute(-minuteStep)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 14,
                    cursor: "pointer",
                    padding: 2,
                    color: "var(--color-muted)",
                  }}
                >
                  ▼
                </button>
              </div>

              {/* AM/PM */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  marginLeft: 8,
                }}
              >
                {["AM", "PM"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      fontSize: 12,
                      fontWeight: 700,
                      background:
                        time.period === p
                          ? "var(--color-primary)"
                          : "var(--color-card)",
                      color:
                        time.period === p
                          ? "var(--color-primary-text)"
                          : "var(--color-text)",
                      cursor: "pointer",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
            }}
          >
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                now.setMinutes(
                  Math.round(now.getMinutes() / minuteStep) * minuteStep,
                  0,
                  0,
                );
                commit(now);
                setViewMonth(startOfMonth(now));
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-muted)",
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="button button-primary"
              style={{ fontSize: 13, padding: "6px 14px", minHeight: 0 }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
