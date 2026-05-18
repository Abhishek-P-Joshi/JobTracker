# JobTrack — Implementation Plan
**Stack**: FastAPI + SQLite · Chrome Extension (MV3) · React/Vite/TypeScript  
**Date**: 2026-05-18  
**Status**: Ready to implement

---

## Overview

A three-part local system for tracking job applications. No authentication. Multi-profile isolation. All three parts communicate through the backend REST API.

| Part | Runtime | Purpose |
|---|---|---|
| **Backend** | Python/FastAPI · `localhost:8000` | SQLite persistence, REST API, analytics, export/import |
| **Chrome Extension** | Manifest V3 | Scrape job listings from job boards, save to backend |
| **Dashboard** | React/Vite · `localhost:5173` | Kanban board, list view, analytics charts, profile management |

---

## Project Structure

```
job-tracker/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry point + CORS
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models.py            # ORM table definitions
│   │   ├── schemas.py           # Pydantic request/response models
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── profiles.py      # Profile CRUD
│   │       ├── jobs.py          # Job CRUD + move endpoint
│   │       ├── analytics.py     # Insights + stats
│   │       └── export.py        # CSV / JSON export + import
│   ├── requirements.txt
│   ├── run.py                   # python run.py → uvicorn on :8000
│   └── seed.py                  # 3–5 sample profiles + jobs
│
├── extension/
│   ├── manifest.json            # Chrome Manifest V3
│   ├── background/
│   │   └── service_worker.js    # Message handler — all fetch() calls to backend
│   ├── content/
│   │   ├── scraper.js           # Detects job site, delegates to site scraper
│   │   └── sites/
│   │       ├── linkedin.js
│   │       ├── naukri.js
│   │       ├── indeed.js
│   │       └── greenhouse.js
│   ├── popup/
│   │   ├── popup.html           # 380px wide, dark theme
│   │   ├── popup.js
│   │   └── popup.css
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
├── dashboard/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts        # Axios instance + all typed API functions
│   │   ├── components/
│   │   │   ├── ProfileSwitcher.tsx
│   │   │   ├── JobCard.tsx
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── JobDetailPanel.tsx
│   │   │   ├── MoveJobsModal.tsx
│   │   │   ├── UndoToast.tsx
│   │   │   ├── layout/
│   │   │   │   └── AppShell.tsx
│   │   │   └── charts/
│   │   │       ├── ApplicationTimeline.tsx
│   │   │       ├── StatusBreakdown.tsx
│   │   │       ├── WorkTypeBreakdown.tsx
│   │   │       ├── TopLocations.tsx
│   │   │       └── SalaryDistribution.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # Kanban + stat cards
│   │   │   ├── Applications.tsx # Table view + filters + bulk actions
│   │   │   ├── Insights.tsx     # 5 Recharts charts
│   │   │   └── Settings.tsx     # Profiles, export, about
│   │   ├── hooks/
│   │   │   ├── useProfile.ts
│   │   │   ├── useJobs.ts       # refetchInterval: 15000
│   │   │   └── useAnalytics.ts
│   │   ├── store/
│   │   │   └── profileStore.ts  # Zustand store + localStorage persistence
│   │   ├── types/
│   │   │   └── index.ts         # Shared TypeScript types + enums
│   │   ├── App.tsx              # React Router + QueryClientProvider
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── start.sh                     # One-command startup for backend + dashboard
├── PLAN.md                      # This file
└── README.md
```

---

## Database Schema

```sql
-- Named profiles, no passwords
CREATE TABLE profiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One row per job application
CREATE TABLE jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id      INTEGER NOT NULL REFERENCES profiles(id),
  company         TEXT NOT NULL,
  title           TEXT NOT NULL,
  url             TEXT,
  location        TEXT,
  work_type       TEXT DEFAULT 'unknown',   -- remote | hybrid | onsite | unknown
  salary_min      INTEGER,
  salary_max      INTEGER,
  currency        TEXT DEFAULT 'INR',
  status          TEXT DEFAULT 'wishlist',  -- wishlist | applied | screening | interview | offer | rejected | ghosted
  source          TEXT,                     -- linkedin | naukri | indeed | greenhouse | lever | manual
  applied_date    DATE,
  notes           TEXT,
  job_description TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Every status change, for the timeline view
CREATE TABLE status_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  note        TEXT
);

-- Future: email matching
CREATE TABLE email_matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  subject     TEXT,
  sender      TEXT,
  matched_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  action      TEXT   -- rejection | interview | offer | followup
);
```

---

## Phase 1 — Backend

### Prerequisites

```bash
python3 --version   # 3.11+
pip3 --version
```

### Setup

```bash
mkdir -p job-tracker/backend
cd job-tracker/backend
python3 -m venv venv
source venv/bin/activate
```

### `requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
pydantic==2.9.2
python-multipart==0.0.12
aiofiles==24.1.0
```

### API Endpoints

**Profiles**
```
GET    /profiles                          List all profiles
POST   /profiles                          Create {name, color}
PUT    /profiles/{id}                     Update name or color
DELETE /profiles/{id}                     Delete (reject 400 if profile has jobs)
```

**Jobs**
```
GET    /jobs?profile_id=&status=&work_type=&search=&sort_by=&order=
POST   /jobs                              Create (auto-writes status_history row)
GET    /jobs/{id}                         Single job with status_history[]
PUT    /jobs/{id}                         Update (auto-writes status_history if status changed)
DELETE /jobs/{id}
PATCH  /jobs/move                         {job_ids: [int], target_profile_id: int}
```

**Analytics** (all scoped to `?profile_id=`)
```
GET    /analytics/summary                 total, by_status counts, response_rate
GET    /analytics/timeline                jobs applied per week (last 12 weeks)
GET    /analytics/locations               group by location, count
GET    /analytics/salary                  min, max, avg of salary_min and salary_max
GET    /analytics/sources                 breakdown by source site
GET    /analytics/work-types              count of remote/hybrid/onsite/unknown
```

**Export / Import**
```
GET    /export/csv?profile_id=            Download CSV of all jobs
GET    /export/json?profile_id=           Download JSON of all jobs
POST   /import/json                       {profile_id, jobs: [...]} bulk insert
```

### Implementation details

- CORS: allow `http://localhost:5173` and `chrome-extension://*`
- `updated_at` auto-updates via SQLAlchemy `@event.listens_for(Job, 'before_update')`
- Status changes write a `status_history` row automatically (old_status=None on create)
- Database file: `backend/jobs.db`
- `check_same_thread=False` on SQLAlchemy engine (prevents SQLite lock errors)

### Validation gate

```bash
python run.py
# → Uvicorn running on http://0.0.0.0:8000

curl http://localhost:8000/profiles
curl -X POST http://localhost:8000/profiles \
  -H "Content-Type: application/json" \
  -d '{"name": "Ravi", "color": "#6366f1"}'
curl http://localhost:8000/analytics/summary?profile_id=1
open http://localhost:8000/docs
```

**Do not start Phase 2 until all endpoints return correct responses.**

---

## Phase 2 — Chrome Extension

### Architecture

- `manifest.json` — MV3, permissions: `storage`, `activeTab`, `scripting`; host permission for `localhost:8000`
- `service_worker.js` — handles all fetch() to backend (avoids CORS from content scripts)
- `scraper.js` — detects hostname, delegates to site-specific scraper
- Site scrapers — return nulls for any field they can't find; never crash

### Site-specific selectors

**LinkedIn** (`linkedin.com/jobs`)
```
title:       .job-details-jobs-unified-top-card__job-title
company:     .job-details-jobs-unified-top-card__company-name
location:    .job-details-jobs-unified-top-card__bullet
work_type:   .job-details-jobs-unified-top-card__workplace-type
description: .jobs-description__content
```

**Naukri** (`naukri.com`)
```
title:     .jd-header-title, h1.title
company:   .jd-header-comp-name, .comp-name
location:  .loc, .location
work_type: text in .other-details ("Work from home" / "Remote" / "Hybrid" / "Work from office")
salary:    .salary — parse "8-12 Lacs" → min: 800000, max: 1200000
```

**Indeed** (`indeed.com`)
```
title:     .jobsearch-JobInfoHeader-title
company:   [data-testid="inlineHeader-companyName"]
location:  [data-testid="job-location"]
work_type: [data-testid="workplace-type"] or keyword scan fallback
```

**Greenhouse** (`boards.greenhouse.io`)
```
title:     h1.app-title
company:   URL path segment
location:  .location
work_type: keyword scan of .content
```

### Work-type detection (all scrapers)

1. Explicit badge/label in DOM
2. Keyword scan of job description (case-insensitive):
   - `remote` → `remote`
   - `hybrid` → `hybrid`
   - `on-site` | `onsite` | `in-office` | `in office` → `onsite`
3. Default: `unknown`

### Service worker message types

```
SAVE_JOB     → POST /jobs
GET_PROFILES → GET /profiles
MOVE_JOBS    → PATCH /jobs/move
```

### Popup UI

- Width: 380px, max-height: 600px scrollable
- Dark theme, clean, minimal, professional
- Sections:
  1. **Header** — "JobTrack" + active profile name
  2. **Profile selector** — dropdown, persisted in `chrome.storage.local`
  3. **Job form** — Company, Title, Location, Work Type, Salary Min/Max, Currency, Status, Source, Applied Date, Notes
  4. **Save button** — "Save to [Profile Name]" → success/error state
  5. **Footer** — "Open Dashboard →" opens `localhost:5173`

### Popup behavior

- On open: fetch profiles, restore active profile from `chrome.storage.local`, run scraper on active tab
- Not on a job site: show "Navigate to a job listing to auto-fill" — form stays usable
- After save: "Saved! ✓" for 2 seconds
- Validation: require company + title before saving

### Load in Chrome

```
1. chrome://extensions
2. Enable Developer mode
3. Load unpacked → select extension/
```

### Validation gate

- Popup opens, profile dropdown populated
- Navigate to LinkedIn job → form auto-fills
- Save → verify with `GET /jobs?profile_id=1`
- Switch profile → save button label updates

---

## Phase 3 — Dashboard

### Prerequisites

```bash
node --version   # 20+
```

### Setup

```bash
cd job-tracker
npm create vite@latest dashboard -- --template react-ts
cd dashboard
npm install axios zustand react-router-dom recharts @tanstack/react-query
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

### Design direction

- Dark theme default (`#0f0f0f` background)
- Accent: `#6366f1` (indigo)
- Typography-forward — strong display font for headings, mono for stats
- Aesthetic: Bloomberg terminal meets Linear.app
- Subtle grid lines, data-rich numbers

### Session A — Foundation

| File | What it does |
|---|---|
| `src/types/index.ts` | `Profile`, `Job`, `StatusHistory`, `AnalyticsSummary`; `Status` + `WorkType` enums |
| `src/api/client.ts` | Axios instance + typed functions for every endpoint |
| `src/store/profileStore.ts` | Zustand: `activeProfile`, `profiles`, `loadProfiles()`, localStorage key `jobtrack_active_profile_id` |
| `src/components/ProfileSwitcher.tsx` | Colored avatar dots, animated dropdown, "+ New Profile" inline form |
| `src/components/layout/AppShell.tsx` | 240px sidebar, nav, ProfileSwitcher, backend status dot, top bar with search |
| `src/App.tsx` | React Router routes + `QueryClientProvider` + profiles load on mount |

### Session B — Pages + Components

**Dashboard page** (`src/pages/Dashboard.tsx`)
- 4 stat cards: Total Applications, Active Pipeline, Response Rate, This Week
- Kanban board: 7 columns (one per status), count badges
- `JobCard`: company, title, location, work type badge, days since applied, salary range
- Click card → `JobDetailPanel` slide-in

**Applications page** (`src/pages/Applications.tsx`)
- Filter bar: status multi-select, work type toggle chips, source filter, search, date range
- Sort: by date, company, status
- Table with checkbox column for bulk selection
- Bulk action bar → `MoveJobsModal`
- Row click → `JobDetailPanel`

**MoveJobsModal** — profile dropdown (excluding current) + confirm → `PATCH /jobs/move` → `UndoToast`

**UndoToast** — 8s bottom-right, progress bar, undo calls `PATCH /jobs/move` back to original profile

**JobDetailPanel** — slide-in from right, inline edit, status dropdown, work type dropdown, status timeline, notes auto-save on blur, "Open listing" link, delete with confirm

**Insights page** (`src/pages/Insights.tsx`) — 5 Recharts charts:
1. **Application Timeline** — LineChart, last 12 weeks
2. **Status Breakdown** — PieChart, click segment filters Applications
3. **Work Type Breakdown** — DonutChart; Remote=teal, Hybrid=indigo, On-site=amber, Unknown=gray; handle all-unknown gracefully
4. **Top Locations** — HorizontalBarChart, top 8
5. **Salary Distribution** — BarChart; handle gracefully when most jobs have no salary

**Settings page** (`src/pages/Settings.tsx`)
- Profiles: list with edit/delete (delete disabled if profile has jobs, tooltip explains)
- Data: Export CSV, Export JSON, Import JSON (file picker → `POST /import/json`)
- About: version, backend URL, total jobs across all profiles

### Status colors (consistent everywhere)

| Status | Color |
|---|---|
| wishlist | gray |
| applied | indigo |
| screening | amber |
| interview | blue |
| offer | green |
| rejected | red |
| ghosted | gray/muted |

### Hooks

- `useJobs` — `refetchInterval: 15000` so dashboard auto-updates when extension saves jobs
- `useAnalytics` — analytics queries scoped to active profile
- `useProfile` — active profile from Zustand store

### UX requirements

- Empty states: friendly messages with action buttons (no illustrations)
- Loading states: skeleton loaders, not spinners
- Mutations: TanStack Query with optimistic updates where possible
- Responsive: primary target 1280px+, degrades gracefully to 900px

### Validation gate

```bash
npm run dev
# localhost:5173
```
- Profile switcher shows profiles, persists on refresh
- Kanban populates from backend
- Status change writes to backend + `status_history`
- Move jobs modal + undo toast work
- All 5 Insights charts render (even with minimal data)
- Work type filter chips work on Applications page
- Export downloads real CSV/JSON

---

## Phase 4 — Polish & Integration

1. **Extension error state** — if `localhost:8000` unreachable, show: *"Backend not running. Start it with: `python run.py`"*
2. **Duplicate URL guard** — if URL already saved for active profile, prompt: *"This job is already saved. Update it or save as new?"*
3. **Keyboard shortcuts** — `Cmd+K` → global search focus, `Escape` → close panel/modal, `N` → add job manually
4. **Manual add modal** — same fields as extension form, accessible from dashboard (button in top bar)
5. **First-run experience** — if no profiles exist, auto-create "Default" profile + welcome banner

### Start script (`start.sh`)

```bash
#!/bin/bash
echo "Starting JobTrack backend..."
cd backend && source venv/bin/activate && python run.py &
BACKEND_PID=$!

sleep 2
echo "Starting JobTrack dashboard..."
cd ../dashboard && npm run dev &
DASHBOARD_PID=$!

echo ""
echo "Backend running at http://localhost:8000"
echo "Dashboard running at http://localhost:5173"
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $DASHBOARD_PID" EXIT
wait
```

```bash
chmod +x start.sh
```

---

## Phase 5 — Email Integration (Future / Out of Scope)

Table this. When ready:
- Gmail API via OAuth 2.0 (credentials in `.env`, tokens in `backend/tokens.json`)
- Background poller every 15 minutes: scan recent emails, match against company names
- Classifier: rejection / interview / offer keywords (or Claude API call)
- On match: update job status, insert `email_matches` row, write `status_history` note

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| LinkedIn/Naukri DOM changes break selectors | High | Scrapers return nulls gracefully; manual form always works |
| Extension CORS blocked from content scripts | Medium | All fetch calls go through `service_worker.js` only |
| SQLite lock errors under concurrent writes | Low | `check_same_thread=False` on engine |
| Port 8000 or 5173 already in use | Low | `lsof -i :8000` before starting |
| Tailwind v4 breaking changes | Low | Pin `tailwindcss@3` in `package.json` |

---

## Common Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| CORS errors in extension | Extension origin not whitelisted | Add `chrome-extension://*` to FastAPI CORS |
| Scraper returns nulls | Site updated HTML | Inspect element, update selectors |
| Dashboard not updating | No polling | `refetchInterval: 15000` on jobs query |
| Port already in use | Old process running | `lsof -i :8000` → `kill <PID>` |
| Extension not loading | Manifest V3 syntax error | Check error in chrome://extensions |
| SQLite locked | Two writers simultaneously | `check_same_thread=False` |

---

## Build Order

```
Phase 1 (Backend)
    ├── Phase 2 (Extension)   ─┐
    └── Phase 3 (Dashboard)   ─┴── Phase 4 (Polish)
```

Phase 2 and Phase 3 can run in parallel once Phase 1 is verified.

---

## Quick Reference

```bash
# Start backend
cd job-tracker/backend && source venv/bin/activate && python run.py

# Start dashboard
cd job-tracker/dashboard && npm run dev

# Start both
./job-tracker/start.sh

# Seed sample data
cd job-tracker/backend && python seed.py

# Test backend
curl http://localhost:8000/profiles
open http://localhost:8000/docs

# Reload extension after changes
# Chrome → chrome://extensions → click refresh icon on JobTrack card
```

---

## Estimated Effort

| Phase | Effort |
|---|---|
| Phase 1 — Backend | 2–3 hrs |
| Phase 2 — Extension | 3–4 hrs |
| Phase 3 — Dashboard | 4–6 hrs (two sessions) |
| Phase 4 — Polish | 1–2 hrs |
| **Total** | **10–15 hrs** |
