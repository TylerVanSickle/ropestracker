# Ropes Tracker

Ropes Tracker is an internal web application built specifically to support **daily operations at our ropes course**.

It is designed to help front desk and floor staff manage guest flow, sling line capacity, and wait times in a clear and consistent way during normal drop-in operations.

---

## Purpose

The goal of Ropes Tracker is to:
- Reduce guesswork around wait times
- Improve communication between staff and guests
- Keep the course running efficiently during busy periods
- Provide a single, clear source of truth for who is on course and who is waiting

This tool reflects how our course actually operates and is being built around real, on-site workflows.

---

## How It Works

- The course has a fixed number of sling lines (configurable in settings).
- Each guest uses one sling line.
- A group’s size determines how many sling lines they require.
- Groups are added to a waitlist and are sent in **strict order**.
- A group can only start when enough sling lines are available.
- Each group stays on the course for a fixed duration (configurable).

This ensures fairness, safety, and predictable flow.

---

## Current Features

### Waitlist Management
- Add guest groups with:
  - Group name
  - Party size
  - Phone number (optional)
  - Internal notes
- Track group status:
  - Waiting
  - On Course
  - Done / No-show
- Edit group details as needed during operations
- Manually reorder the waitlist when required by staff

### Capacity & Timing
- Live tracking of sling line usage
- Automatic release of lines when groups finish
- Realistic wait time estimates based on current activity
- Clear indication when the next group can be sent

### Staff Communication
- “Call Now” indicator for the next eligible group
- Optional call / text helpers for contacting guests
- Simple, readable interface designed for fast decision-making

---

## Public Display Mode (In Progress)

A read-only screen intended for display on a monitor or TV near the course:
- Shows who is currently on the course
- Displays which group is next
- Provides estimated wait times for common group sizes
- Hides internal-only information (notes, phone numbers, sling line counts)

This is intended to reduce repeated guest questions and improve transparency.

---

## Technical Notes

- Built with Next.js (App Router)
- Uses client-side storage (`localStorage`)
- No backend or database required at this stage
- Modular React components for maintainability
- Custom CSS tailored to on-site usage

---

## Status

Ropes Tracker is actively under development and testing and is being refined based on real usage by staff at the course.

The system will continue to evolve as operational needs change.
