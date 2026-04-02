# Ropes Course Waitlist — Operations & Technical Manual

A web-based waitlist and course management system for the ropes course. Built with Next.js, Supabase (cloud database), and Twilio (SMS notifications). Runs entirely in the browser — no app installs required on any device.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [The Screens](#the-screens)
3. [Day-to-Day Staff Usage](#day-to-day-staff-usage)
4. [Lead / Overdrive Mode](#lead--overdrive-mode)
5. [Settings Reference](#settings-reference)
6. [Analytics](#analytics)
7. [Services & Accounts](#services--accounts)
8. [Environment Variables](#environment-variables)
9. [Running the App Locally](#running-the-app-locally)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)
12. [File & Code Overview](#file--code-overview)

---

## What It Does

Staff at the front desk add guest groups to a live waitlist. The app tracks how many sling lines are in use, calculates realistic wait time estimates per group, and sends SMS notifications when a group is up next. A separate screen for the top-of-course operator manages actual course timers and marks groups as done. A public display shows the queue to waiting guests without exposing any staff controls.

**Core rules the system enforces:**
- Groups move through the queue in **strict FIFO order** — no skipping
- A group can only be sent up when enough **sling lines are available** for their entire party
- Course timers are started by the **top operator**, not the front desk
- Analytics always records the **originally registered party size** — not any mid-session adjustments

---

## The Screens

### `/` — Front Desk

The main screen for whoever is working intake. Requires staff authentication (cookie-based — logs in once and stays logged in for 7 days).

**Add Guest form:**
- Name/group label, party size, phone number, and optional notes
- Party size is capped at the number of sling lines configured in Settings (normally 15)
- Phone number is formatted automatically as US format

**Waiting list:**
- Shows all groups queued up with their estimated start time and wait range
- The first group is highlighted as **NEXT**
- ↑ ↓ arrows let staff manually reorder
- Each entry has **Edit**, **Notify**, and **Send Up** buttons

**Up Now list:**
- Shows groups currently on the course with a countdown timer
- **Edit** lets desk staff adjust group details or complete/remove an active run

**Top bar buttons:**

| Button | What it does |
|--------|-------------|
| Top | Opens `/top` operator screen in same tab |
| Client | Opens `/client` guest display in a new tab |
| Undo | Reverts the last change (add, remove, reorder, clear) |
| Clear List | End-of-day wipe — moves everything to history (requires typing CLEAR) |
| Lead Mode | Unlocks overdrive capacity for oversized groups (see below) |
| Settings | Course configuration |
| Archive | Browse past sessions |
| Analytics | Usage charts and stats |
| QR Codes | Print/display QR codes for the guest self-check-in flow |

---

### `/top` — Top Ropes Operator

Used by the staff member physically at the top/course floor. Shows groups that have been sent up by the desk.

**Typical flow:**

1. A group appears in **Coming Up** after the desk clicks Send Up.
2. Operator assigns a **tag** (color/animal identifier — Bear, Fox, Eagle, etc.) so the group can be identified on the course.
3. Once the group is harnessed and ready, operator clicks **Start Course** — starts a countdown timer (default 35 minutes, configurable).
4. When finished, operator clicks **Finish** → confirms → the run is saved to analytics history and lines are freed.

**Other controls on this screen:**

| Control | What it does |
|---------|-------------|
| +5 min | Extends the active course timer by 5 minutes |
| Edit | Adjust lines in use, name, phone, notes — does NOT change the registered party size used in analytics |
| Merge | Combines two groups into one entry if they're running together |

---

### `/client` — Public Guest Display

Read-only screen designed to run on a TV or a tablet in the waiting area. No staff controls are shown. Guests can see who's next, approximate wait times, and general queue status.

- Refreshes automatically
- Does not require login
- Theme (light/dark/auto) is controlled by **Settings → Client display theme**

---

### `/settings` — Settings

All settings sync to the database, so changes apply across every device immediately. See the [Settings Reference](#settings-reference) section for full details.

---

### Other Pages

| URL | Purpose |
|-----|---------|
| `/analytics` | Charts and totals for completed runs |
| `/archive` | Browse and search past session archives |
| `/print` | Print-friendly waitlist snapshot |
| `/admin/qr` | Generate QR codes for guest self-check-in |
| `/staff/login` | Staff password login (only shown if a staff wall password is configured) |

---

## Day-to-Day Staff Usage

### Opening the course

1. Navigate to the app URL on the front desk device.
2. If prompted for a staff password, enter it. The session lasts 7 days — you won't be asked again until it expires.
3. Check that **Total sling lines available** in Settings matches what's actually in service that day.
4. Set **Public status → Open** in Settings so the guest display shows estimates.

### Adding a group

1. Fill in the **Add Guest** form: name, party size, phone number, and optional notes.
2. Click **Add to waitlist**. They appear at the bottom of the queue immediately.
3. The estimated wait time is calculated automatically based on groups ahead of them.

### Sending a group up

1. The **first group** in the waiting list can be sent up when enough lines are free.
2. When the **Send Up** button is active (not grayed out), click it — the group moves to the top operator's Coming Up list.
3. The desk cannot start the course timer — that's the operator's job.

### Notifying a group

1. Click **Notify** on any group.
2. A confirmation dialog appears — confirm to send the SMS.
3. The guest receives a text saying they're up next with an estimated time.
4. If there is no phone number on file, the message is copied to clipboard instead so staff can send it manually.
5. There is a **2-minute cooldown** between notifications to the same group.

### Completing a group

- **From `/top`:** Click Finish → confirm. The run is saved to analytics.
- **From `/` desk:** Open Edit on an active (Up Now) group → click Complete in the Danger Zone → type YES.

### Editing a group

- Click **Edit** on any entry to change name, phone, party size, or notes.
- If the group is currently active on course, you can also adjust their time remaining.
- Removing a group requires typing **YES** to confirm.

### End of day

1. Click **Clear List** in the top bar.
2. Type `CLEAR` and confirm.
3. All active entries are moved to the archive.
4. Go to **Settings → Public status → Close** so the guest screen shows a closed banner.

---

## Lead / Overdrive Mode

Used when a group arrives with more people than the normal capacity limit allows (normally capped at 15).

**Setup (one time, done by a manager):**
1. Go to **Settings → Lead / Overdrive PIN**.
2. Enter a 4-digit PIN and click **Save PIN**.
3. This PIN is stored only on that device — it is not synced to the database.

**Enabling Lead Mode (daily use):**
1. On the main page, click **Lead Mode** in the top bar.
2. Enter the Lead PIN.
3. **"Lead ON ✕"** appears in the top bar — Lead Mode is now active for this session.

**What changes in Lead Mode:**
- Party size limit increases from **15 → 20** when adding or editing groups.
- The **Send Up** button enables even when all 15 normal lines are occupied, allowing an oversized group to go up.
- Lead Mode is session-only — it deactivates when the page is refreshed or the ✕ is clicked.

**To disable early:** Click the **Lead ON ✕** button in the top bar.

> Analytics always records the originally registered party size regardless of lead mode or any edits made by the top operator.

---

## Settings Reference

### Public display

| Setting | Description |
|---------|-------------|
| Display name | The venue name shown on the `/client` screen |
| Public status | Open / Closed. "Closed" shows a banner on the guest screen and hides wait estimates |
| Client display theme | Auto / Light / Dark — controls the **guest `/client` screen** appearance only |
| Staff view theme | Auto / Light / Dark — controls the **staff pages** appearance, saved per device only (not synced) |

### Course inventory

| Setting | Description |
|---------|-------------|
| Total sling lines available | How many lines are in service today. Reduce if a line is broken or pulled out of rotation |
| Desk "Send Up" duration | How many minutes the desk estimates from send-up to course start. Used for wait time calculations |
| Top Ropes "Start Course" timer | The countdown (in minutes) that starts when the operator clicks Start Course |

### Lead / Overdrive PIN

A 4-digit PIN that unlocks Lead Mode on the main page. Stored locally in the browser — not synced to the database or visible to other devices. Leave blank to disable Lead Mode entirely.

### Staff PIN

If set, anyone opening the staff view (`/`) must enter this PIN before seeing the waitlist. Stored in the database — applies to all devices. If you're locked out, you can clear it directly in the Supabase database (see Troubleshooting).

---

## Analytics

Accessible from **Analytics** in the top bar.

Shows data for groups that were marked as **completed** (status = DONE). Covers:

- **Total groups run** and **total people served** in the date range
- **Average party size**, average wait time, average duration
- **Daily trend chart** — groups and people per day
- **Busiest hour of day** and **busiest day of week**
- **Tag breakdown** — which course identifiers (Bear, Eagle, etc.) were used most
- **Status breakdown** — how runs were completed or ended

**Important:** Analytics records the **registered party size** from when the group was added to the waitlist. If the top operator adjusts lines-in-use mid-session, that adjustment is tracked operationally but does not affect what analytics records. This ensures headcount totals are accurate.

All times display in **Mountain Time (America/Denver)**.

---

## Services & Accounts

### Supabase (Database)

All waitlist data, settings, and completed run history are stored in a Supabase (hosted PostgreSQL) database. The app works offline using browser localStorage and syncs to Supabase when the connection is available.

- **Project dashboard:** [app.supabase.com](https://app.supabase.com)
- **Tables used:**
  - `ropes_settings` — course configuration and settings
  - `ropes_entries_live` — currently active waitlist entries
  - `ropes_entries_history` — completed/archived runs (source for analytics)

The credentials to access the Supabase dashboard are separate from the app's API keys. Contact the developer or check the company's password manager for the Supabase login.

### Twilio (SMS)

Used to send text message notifications to guests when they're up next.

- **Account dashboard:** [console.twilio.com](https://console.twilio.com)
- SMS is sent from the Twilio phone number configured in `.env.local`
- If Twilio is unavailable or the number isn't configured, the app falls back to opening the device's native SMS app with the message pre-filled

> **Note:** New Twilio accounts require carrier approval before SMS delivery works reliably. This can take a few days. Error codes 30032 or 30034 in the Twilio console mean approval is still pending.

---

## Environment Variables

The app requires a `.env.local` file in the project root. **This file must never be committed to version control — it contains secret keys.**

```
# Twilio — SMS notifications
TWILIO_ACCOUNT_SID=           # From Twilio console → Account Info
TWILIO_AUTH_TOKEN=            # From Twilio console → Account Info
TWILIO_PHONE_NUMBER=          # Your Twilio number, e.g. +18015551234

# Staff wall — password-protect the staff pages
STAFF_WALL_PASSWORD=          # The password staff use at /staff/login
STAFF_WALL_COOKIE_SECRET=     # A long random string (at least 32 chars) for signing cookies
STAFF_WALL_COOKIE_NAME=ropes_staff

# Supabase — database
NEXT_PUBLIC_SUPABASE_URL=            # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # Supabase anon/public key (safe to expose to browser)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=  # Supabase publishable key
SUPABASE_URL=                        # Same as NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=           # Supabase service role key — KEEP THIS SECRET

# Site identity
ROPES_SITE_SLUG=main
NEXT_PUBLIC_ROPES_SITE_ID=    # UUID of your site row in ropes_settings
```

> The actual values for all of the above are in the `.env.local` file on the developer's machine. **Keep a secure backup** of that file (company password manager or secure shared drive). If the Supabase or Twilio keys are ever lost, new ones must be generated through those services' dashboards.

---

## Running the App Locally

**Requirements:**
- [Node.js](https://nodejs.org) 18 or newer
- npm (comes with Node)

```bash
# 1. Install dependencies
npm install

# 2. Ensure .env.local exists in the project root with all variables filled in

# 3. Start the development server
npm run dev
```

Open `http://localhost:3000` in a browser. Changes to source files hot-reload automatically.

**Production build (for testing before deploy):**

```bash
npm run build
npm start
```

---

## Deployment

The app is a standard Next.js application. It can be hosted on any platform that supports Node.js.

**Recommended: [Vercel](https://vercel.com)** (made by the Next.js team — free tier is sufficient)

1. Push the codebase to a private GitHub repository.
2. Go to [vercel.com](https://vercel.com), connect your GitHub account, and import the repository.
3. In Vercel's project **Settings → Environment Variables**, add every variable from `.env.local`.
4. Click Deploy. Every push to the `main` branch redeploys automatically.

> Do not commit `.env.local` to GitHub. The `.gitignore` file already excludes it.

---

## Troubleshooting

### "Saved locally — couldn't sync" toast message

The app lost connection to Supabase. Data is preserved in the browser and will sync automatically when the connection is restored. Check internet connection and the [Supabase status page](https://status.supabase.com).

### SMS texts are not being delivered

1. Confirm `TWILIO_PHONE_NUMBER` is set in `.env.local` (not empty).
2. Log in to the Twilio console and check the message logs for error codes.
3. Codes **30032** or **30034** mean carrier approval is still pending — this resolves on its own in a few days for new accounts.
4. The app will offer to open the native SMS app as a fallback if Twilio fails.

### Staff are locked out (PIN not working)

The Staff PIN is stored in the Supabase database (`ropes_settings` table, `staff_pin` column). To reset it:
1. Log in to [app.supabase.com](https://app.supabase.com).
2. Open the Table Editor → `ropes_settings`.
3. Find the row for your site and set `staff_pin` to an empty string.
4. The app will then let anyone in without a PIN until a new one is set in Settings.

### Lead PIN is lost

The Lead PIN is stored only in the browser's localStorage under the key `ropes_lead_pin_v1`. It is NOT in the database. To reset it:
1. On any staff device, go to **Settings → Lead / Overdrive PIN**.
2. Enter and save a new PIN. This will overwrite the old one on that device.
3. If you need to clear it on other devices, open browser DevTools → Application → Local Storage → delete `ropes_lead_pin_v1`.

### Wait time estimates seem off

1. Check that **Total sling lines available** in Settings matches actual in-service lines.
2. Verify the **Desk "Send Up" duration** is set to a realistic number — this is the primary input to the estimation algorithm.
3. If groups are stuck as "waiting" but lines look free, check whether any groups are stuck in "UP" status with no timer (edit and complete them manually).

### Blank screen / nothing loads

1. Check the browser console (F12) for errors.
2. Verify `.env.local` exists and has all required variables.
3. Try `npm run build` to catch any code errors.
4. Clearing the browser's localStorage for the app domain sometimes resolves stale state issues: DevTools → Application → Local Storage → right-click and Clear.

---

## File & Code Overview

```
ropestracker/
├── .env.local                     # Secret keys — DO NOT commit this file
├── package.json                   # Node dependencies and scripts
│
└── src/app/
    ├── page.js                    # Front desk main screen
    ├── layout.js                  # Root HTML layout (dark mode init, fonts)
    ├── globals.css                # All shared styles + dark mode variables
    │
    ├── top/
    │   ├── page.jsx               # Top ropes operator screen
    │   └── components/
    │       └── EditGroupModal.jsx # Edit a group's details from the operator screen
    │
    ├── client/page.jsx            # Public guest display (/client)
    ├── settings/page.js           # Settings page
    ├── analytics/page.jsx         # Analytics dashboard
    ├── archive/page.jsx           # Session archive browser
    ├── print/page.jsx             # Print-friendly view
    ├── admin/qr/page.jsx          # QR code generator
    ├── staff/login/page.jsx       # Staff login page
    │
    ├── api/
    │   ├── state/route.js         # Core DB: read/write entries and settings
    │   ├── sms/route.js           # Sends SMS via Twilio
    │   ├── analytics/route.js     # Serves analytics data to the dashboard
    │   ├── archive/route.js       # Archive read/write operations
    │   └── public/state/route.js  # Read-only state for the guest display
    │
    ├── components/ropes/
    │   ├── Topbar.jsx             # Top bar (Lead Mode button lives here)
    │   ├── AddGuestForm.jsx       # Form to add a new guest group
    │   ├── WaitingList.jsx        # The queue display
    │   ├── UpNowList.jsx          # Groups currently on course
    │   ├── NextUpActions.jsx      # Quick-action panel for the next group
    │   ├── EditEntryModal.jsx     # Edit modal for any entry
    │   ├── ConfirmModal.jsx       # Simple yes/no confirmation dialog
    │   ├── ConfirmDangerModal.jsx # Two-step confirmation (requires typing a word)
    │   └── AlertToast.jsx         # Brief notification pop-ups
    │
    └── lib/
        ├── ropesStore.js          # localStorage management, settings, constants
        ├── ropesUtils.js          # Wait time estimation algorithm
        ├── ropesMessage.js        # SMS message template
        ├── smsClient.js           # Twilio API wrapper
        ├── staffWallAuth.js       # Staff session cookie logic
        ├── supabaseAdmin.js       # Server-side Supabase client (uses service role key)
        ├── supabaseBrowser.js     # Browser-side Supabase client (uses anon key)
        └── alerts.js              # Overdue group alert logic
```

### Key constants

| Constant | Value | Where | Meaning |
|----------|-------|-------|---------|
| `MAX_SLING_LINES` | `15` | `ropesStore.js` | Normal maximum party size |
| Overdrive max | `20` | `page.js` | Maximum party size in Lead Mode |
| SMS cooldown | 2 minutes | `page.js` | Min time between texts to the same group |
| Staff cookie lifetime | 7 days | `staffWallAuth.js` | How long a staff login lasts before re-login |
| Lead PIN storage key | `ropes_lead_pin_v1` | browser localStorage | Where the Lead PIN is saved per device |

---

*Built for Thanksgiving Point Ropes Course operations.*
*For technical questions about the codebase, contact the developer who built this system.*
