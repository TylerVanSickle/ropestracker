# Ropes Tracker

A simple, real-time waitlist and capacity management app designed for **drop-in ropes courses**.

Ropes Tracker helps front desk and floor staff manage guest flow, track course capacity, and communicate accurate wait times — without guessing or manual tracking.

---

## Overview

Ropes Tracker is built for attractions with limited capacity (such as sling lines) and continuous walk-up guests.

It provides a clear view of:
- Who is currently on the course
- Who is next in line
- How long the wait is for different group sizes
- When the next group can safely be sent

The goal is **clarity, speed, and ease of use** for both staff and guests.

---

## Key Features

- **Live Waitlist Management**
  - Add guest groups with name, party size, phone, and notes
  - Track groups as *Waiting*, *On Course*, or *Done*
  - Edit group details at any time

- **Capacity-Aware Queue**
  - Uses a fixed number of sling lines (configurable)
  - Group size directly maps to lines used
  - Enforces strict first-in-line order (no skipping)

- **Automatic Wait Time Estimates**
  - Calculates realistic estimated start times
  - Displays guest-friendly wait ranges (ex: `20–30 min`)
  - Updates automatically as the course fills or clears

- **“Call Now” Logic**
  - Clearly indicates when the next group can start
  - Only triggers when enough capacity is available
  - Optional call / text helpers for guest notification

- **Staff-Friendly Design**
  - Clear, human-readable language
  - Built for fast scanning during busy operations
  - No technical jargon shown to guests

---

## Public Display Mode (In Progress)

A read-only **TV / monitor view** designed for guests waiting nearby:
- Shows *Now On Course* and *Next Up*
- Displays estimated waits for common group sizes
- Hides internal details (capacity counts, notes, phone numbers)

This reduces repeated questions and improves guest confidence.

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **State:** Client-side with `localStorage`
- **UI:** Custom CSS (no UI framework)
- **Architecture:** Modular React components

No backend or database is required at this stage, keeping the system lightweight and easy to deploy.

---

## Use Case

Designed specifically for:
- Drop-in ropes courses
- Front desk + floor staff operations
- High guest turnover with limited capacity

---

## Status

This project is actively developed and tested in a **real ropes course environment** and is evolving based on staff feedback and daily operations.

---

## Future Enhancements

- Daily usage stats and reporting
- QR code guest check-in
- Optional database backend
- Staff roles (view vs edit)
