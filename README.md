# Ropes Tracker

Ropes Tracker is an internal web application built specifically to support **day to day operations at our ropes course**.

It helps front desk staff and top-ropes operators manage guest flow, sling line capacity, and wait times in a clear, consistent, and fair way during normal drop-in operations.

This tool is intentionally designed around **how the course actually runs in real life**, not a generic queue or ticketing system.

---

## Purpose

Ropes Tracker exists to:

- Reduce guesswork around wait times
- Improve clarity and consistency for guests
- Keep sling line usage accurate and visible
- Prevent line skipping during busy periods
- Provide a single, shared operational source of truth

The system enforces simple, predictable rules so staff can focus on guests instead of mentally tracking timing and capacity.

---

## Core Operational Model

- The course has a fixed number of **sling lines** (configurable)
- Each guest uses **one sling line**
- A group’s size determines how many sling lines they require
- Groups move through the system in **strict FIFO order** (First In, First Out)
- A group may only advance when enough sling lines are available
- Course timers are started by **top ropes operators**, not the front desk

This mirrors real world operations and ensures fairness, safety, and predictable flow.

---

## Application Views

### `/` — Staff / Front Desk View

Used by front desk staff to manage intake, waitlists, and guest communication.

**Primary actions:**

- Add guest groups to the waitlist
- View realistic wait time estimates
- Notify the next eligible group
- Send a group “up” when capacity allows
- Edit or remove entries as needed

**Important behavior:**

- Sending a group up **does not start their course timer**
- It marks the group as “coming up” for operators
- Front desk staff cannot place groups directly on course

---

### `/top` — Top Ropes Operator View

Used by operators actively managing the course floor.

**Primary actions:**

- View groups that are coming up
- Assign each group a predefined **animal / color identifier**
- Start a group’s course timer once they physically load
- Extend time, end early, or mark groups done
- Free sling lines immediately when a group finishes

**Important behavior:**

- A group identifier is required before starting a course
- Operators use a **separate course duration** (default: 35 minutes)
- Only operators can place a group **On Course**

This prevents accidental timing errors and reflects real operator responsibility.

---

### `/client` — Public Display View

A read only display intended for TVs or guest phones.

**Displays:**

- Open / Closed status
- The next group up
- Approximate wait times for upcoming groups
- General estimates for common group sizes

**Does NOT display:**

- Phone numbers
- Internal notes
- Sling line counts
- Group identifiers or staff controls

This reduces repeated guest questions while keeping expectations clear.

---

## Queue & Fairness Rules

Ropes Tracker strictly enforces **FIFO (First In, First Out)** ordering.

- Each group is assigned a stable `queueOrder`
- The system always processes the earliest eligible group
- Groups cannot be accidentally skipped
- Any reordering is explicit and intentional

This guarantees fairness and consistency during peak traffic.

---

## Capacity & Timing

- Sling line usage is tracked live
- Lines are reserved when a group is placed on course
- Lines are released automatically when:
  - A timer expires
  - A group is ended early
  - A group is marked done
- Wait time estimates update instantly across all screens

---

## Settings

Configurable via `/settings`:

- Total sling lines available
- Default session duration (front desk estimates)
- Top ropes course duration (operator timer)
- Open / Closed status
- Venue display name
- Public display theme
- Optional staff PIN for access control

All changes apply immediately on the same device.

---

## Technical Notes

- Built with **Next.js (App Router)**
- Fully client side (no backend or database)
- Uses `localStorage` for persistence
- Uses `BroadcastChannel` and `storage` events for same device sync
- Modular React component architecture
- Designed for tablets, desktops, and wall displays

This allows the system to run offline and without external infrastructure.

---

## Current Limitations

- State is shared **only on the same device** (tabs/windows)
- Multiple physical devices do not sync
- No external database or authentication system

The codebase is intentionally structured so a backend can be added later if needed.

---

## Status

Ropes Tracker is actively used and refined based on real staff feedback and live course operations.

The system will continue to evolve as operational needs change.
