# Ropes Tracker

Ropes Tracker is an internal web application built specifically to support **day-to-day operations at our ropes course**.

It is designed to help front desk staff and top-ropes operators manage guest flow, sling line capacity, and wait times in a clear, consistent, and fair way during normal drop-in operations.

This tool is intentionally modeled around **how the course actually runs in real life**, not a generic queue system.

---

## Purpose

The goal of Ropes Tracker is to:

- Reduce guesswork around wait times
- Improve communication between staff and guests
- Keep sling line usage accurate and visible
- Prevent line-skipping and confusion during busy periods
- Provide a single, shared source of truth for operations

The system enforces simple, predictable rules so staff can focus on guests instead of tracking timing and capacity in their heads.

---

## Core Concept

- The course has a fixed number of **sling lines** (configurable in settings)
- Each guest uses **one sling line**
- A group’s size determines how many sling lines they require
- Groups move through the system in **strict FIFO order** (First In, First Out)
- A group can only move forward when enough sling lines are available
- Timers are started by the **top-ropes operator**, not the front desk

This ensures fairness, safety, and predictable flow across the entire course.

---

## Application Views

### `/` — Staff / Front Desk View

Used by front desk staff to manage the waitlist and guest communication.

**Key responsibilities:**

- Add guest groups to the waitlist
- View realistic wait time estimates
- Notify the next eligible group
- Send a group “up” when space is available
- Edit or remove groups as needed

**Important behavior:**

- Sending a group up **does not start their course timer**
- It marks the group as “coming up” for operators
- Front desk staff cannot place groups directly on course

---

### `/top` — Top Ropes Operator View

Used by floor operators managing the active course.

**Key responsibilities:**

- See all groups that are coming up
- Assign each group a predefined **animal/color identifier**
- Start a group’s course timer when they physically load
- End groups early or extend time as needed
- Mark groups done to immediately free sling lines

**Important behavior:**

- Operators must select a group identifier before starting a group
- Starting a group uses a **separate course duration** (default: 35 minutes)
- Only operators can place a group **On Course**

This mirrors real operations and prevents accidental timing errors.

---

### `/client` — Public Display View

A read-only display intended for TVs or guest phones.

**Shows:**

- Whether the course is open or closed
- The next group up
- Approximate wait times for a small number of upcoming groups
- General estimates for common group sizes

**Does NOT show:**

- Phone numbers
- Internal notes
- Sling line counts
- Group identifiers or staff actions

This reduces repeated guest questions and keeps expectations clear.

---

## Queue & Fairness Rules

Ropes Tracker enforces **FIFO (First In, First Out)** ordering.

- Every waiting group is assigned a stable `queueOrder`
- The system always processes the earliest group first
- Groups cannot be accidentally skipped
- Reordering is explicit and controlled

This guarantees fairness and avoids confusion during peak traffic.

---

## Capacity & Timing

- Sling line usage is tracked live
- Lines are reserved when a group is placed on course
- Lines are automatically released when:
  - A timer expires
  - A group is ended early
  - A group is marked done
- Wait time estimates update immediately across all screens

---

## Settings

Configurable from `/settings`:

- Total sling lines available
- Default session duration (front desk estimates)
- Top-ropes course duration (operator timer)
- Open / Closed status
- Venue display name
- Public display theme
- Optional staff PIN for access control

All settings apply instantly on the same device.

---

## Technical Notes

- Built with **Next.js (App Router)**
- Fully client-side (no backend or database)
- Uses `localStorage` for persistence
- Uses `BroadcastChannel` and `storage` events for same-device syncing
- Modular React components
- Designed for tablets, desktops, and wall displays

This allows the system to run offline and without IT infrastructure.

---

## Current Limitations

- State is shared **only on the same device** (tabs/windows)
- Multiple physical devices do not sync yet
- No external database or authentication system

The codebase is intentionally structured so a backend can be added later if desired.

---

## Status

Ropes Tracker is actively used and refined based on real staff feedback and live course operations.

The system will continue to evolve as operational needs change.
