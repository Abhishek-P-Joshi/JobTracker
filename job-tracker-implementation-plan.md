# Job Tracker — Implementation Plan
### MacOS · Claude Code · FastAPI + SQLite + React + Chrome Extension

---

## Overview

You are building a three-part local system:
- **Backend** — Python/FastAPI REST API with SQLite, running on `localhost:8000`
- **Chrome Extension** — Captures job listings from job boards, saves to backend
- **Dashboard** — React/Vite SPA, running on `localhost:5173`

All three talk to each other. The backend is the single source of truth. The extension and dashboard are both clients.

---

## Prerequisites

Install these before starting. Run each check command to confirm.

```bash
# Python 3.11+
python3 --version

# Node 20+
node --version

# pip
pip3 --version

# Chrome (for extension testing)
open /Applications/Google\ Chrome.app

# Claude Code (install if not already)
npm install -g @anthropic-ai/claude-code
```

If Python is outdated: `brew install python@3.12`
If Node is outdated: `brew install node`

---

## Project Structure

Create this folder layout before opening Claude Code. Everything lives under one root.

```
job-tracker/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models.py            # DB table definitions
│   │   ├── schemas.py           # Pydantic request/response models
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── profiles.py      # Profile CRUD
│   │       ├── jobs.py          # Job CRUD + move endpoint
│   │       ├── analytics.py     # Insights + stats
│   │       └── export.py        # CSV / JSON export + import
│   ├── requirements.txt
│   └── run.py                   # python run.py to start server
│
├── extension/
│   ├── manifest.json            # Chrome Manifest V3
│   ├── background/
│   │   └── service_worker.js    # Handles API calls, badge updates
│   ├── content/
│   │   ├── scraper.js           # Detects job sites, extracts data
│   │   └── sites/
│   │       ├── linkedin.js      # LinkedIn-specific selectors
│   │       ├── naukri.js        # Naukri-specific selectors
│   │       ├── indeed.js        # Indeed-specific selectors
│   │       └── greenhouse.js    # Greenhouse ATS selectors
│   ├── popup/
│   │   ├── popup.html           # Extension popup UI
│   │   ├── popup.js             # Popup logic
│   │   └── popup.css            # Popup styles
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
├── dashboard/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts        # Axios instance + all API calls
│   │   ├── components/
│   │   │   ├── ProfileSwitcher.tsx
│   │   │   ├── JobCard.tsx
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── JobTable.tsx
│   │   │   ├── JobDetailPanel.tsx
│   │   │   ├── MoveJobsModal.tsx
│   │   │   ├── UndoToast.tsx
│   │   │   └── charts/
│   │   │       ├── StatusBreakdown.tsx
│   │   │       ├── ApplicationTimeline.tsx
│   │   │       ├── WorkTypeBreakdown.tsx
│   │   │       ├── LocationMap.tsx
│   │   │       └── SalaryRange.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # Kanban + stats overview
│   │   │   ├── Applications.tsx # Full list view + filters
│   │   │   ├── Insights.tsx     # Charts and analytics
│   │   │   └── Settings.tsx     # Profiles management, export
│   │   ├── hooks/
│   │   │   ├── useProfile.ts    # Active profile state
│   │   │   ├── useJobs.ts       # Jobs data + mutations
│   │   │   └── useAnalytics.ts  # Stats queries
│   │   ├── store/
│   │   │   └── profileStore.ts  # Zustand store for active profile
│   │   ├── types/
│   │   │   └── index.ts         # Shared TypeScript types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
└── README.md
```

---

## Database Schema

Four tables. Understand these before building — everything else derives from them.

```sql
-- Named profiles, no passwords
CREATE TABLE profiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT '#6366f1',  -- avatar accent color
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One row per job application
CREATE TABLE jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id    INTEGER NOT NULL REFERENCES profiles(id),
  company       TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT,
  location      TEXT,
  work_type     TEXT DEFAULT 'unknown',
    -- 'remote' | 'hybrid' | 'onsite' | 'unknown'
  salary_min    INTEGER,
  salary_max    INTEGER,
  currency      TEXT DEFAULT 'INR',
  status        TEXT DEFAULT 'wishlist',
    -- wishlist | applied | screening | interview | offer | rejected | ghosted
  source        TEXT,
    -- linkedin | naukri | indeed | greenhouse | lever | manual
  applied_date  DATE,
  notes         TEXT,
  job_description TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tracks every status change for timeline view
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
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id       INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  subject      TEXT,
  sender       TEXT,
  matched_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  action       TEXT   -- 'rejection' | 'interview' | 'offer' | 'followup'
);
```

---

## Phase 1 — Backend

**Goal:** A running FastAPI server with all endpoints the extension and dashboard need.

### Step 1.1 — Bootstrap the backend

```bash
mkdir -p job-tracker/backend
cd job-tracker/backend
python3 -m venv venv
source venv/bin/activate
```

Create `requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
pydantic==2.9.2
python-multipart==0.0.12
aiofiles==24.1.0
```

```bash
pip install -r requirements.txt
```

### Step 1.2 — Claude Code prompt (backend)

Open Claude Code from the `backend/` directory:

```bash
cd job-tracker/backend
claude
```

Use this prompt to generate the full backend in one pass:

---

**Claude Code Prompt — Backend:**

```
Build a complete FastAPI backend for a local job application tracker.

SCHEMA (SQLite via SQLAlchemy):
- profiles: id, name, color (#hex), created_at
- jobs: id, profile_id (FK), company, title, url, location, work_type (enum: remote/hybrid/onsite/unknown,
  default unknown), salary_min, salary_max,
  currency (default INR), status (enum: wishlist/applied/screening/interview/offer/rejected/ghosted),
  source (linkedin/naukri/indeed/greenhouse/lever/manual), applied_date, notes,
  job_description, created_at, updated_at
- status_history: id, job_id (FK cascade delete), old_status, new_status, changed_at, note
- email_matches: id, job_id (FK set null), subject, sender, matched_at, action

ENDPOINTS NEEDED:

Profiles:
  GET    /profiles                     — list all profiles
  POST   /profiles                     — create profile {name, color}
  PUT    /profiles/{id}                — update name or color
  DELETE /profiles/{id}                — delete (reject if profile has jobs)

Jobs:
  GET    /jobs?profile_id=&status=&work_type=&search=&sort_by=&order=  — list with filters
  POST   /jobs                         — create job (auto-create status_history entry)
  GET    /jobs/{id}                    — single job with status_history
  PUT    /jobs/{id}                    — update any field (auto-update status_history if status changed)
  DELETE /jobs/{id}                    — delete job
  PATCH  /jobs/move                    — body: {job_ids: [int], target_profile_id: int}

Analytics (all scoped to profile_id query param):
  GET    /analytics/summary?profile_id=   — total jobs, by status counts, response rate
  GET    /analytics/timeline?profile_id=  — jobs applied per week (last 12 weeks)
  GET    /analytics/locations?profile_id= — group by location, count
  GET    /analytics/salary?profile_id=    — min, max, avg salary_min and salary_max
  GET    /analytics/sources?profile_id=   — breakdown by source site
  GET    /analytics/work-types?profile_id= — count of remote/hybrid/onsite/unknown

Export/Import:
  GET    /export/csv?profile_id=       — download CSV of all jobs for profile
  GET    /export/json?profile_id=      — download JSON of all jobs for profile
  POST   /import/json                  — body: {profile_id, jobs: [...]} — bulk insert

OTHER REQUIREMENTS:
- Enable CORS for localhost:5173 and chrome-extension://*
- updated_at should auto-update on job PUT via SQLAlchemy event or before_update hook
- Status changes must write a row to status_history automatically
- Database file stored at backend/jobs.db
- Include a run.py that runs: uvicorn app.main:app --reload --port 8000
- Include meaningful error responses (404 with detail, 400 for constraint violations)
- Add 3-5 sample profiles and jobs in a seed.py script

Structure files as: app/main.py, app/database.py, app/models.py, app/schemas.py,
app/routers/profiles.py, app/routers/jobs.py, app/routers/analytics.py, app/routers/export.py
```

---

### Step 1.3 — Verify the backend

```bash
python run.py
# Should show: Uvicorn running on http://0.0.0.0:8000

# In a new terminal, test key endpoints:
curl http://localhost:8000/profiles
curl -X POST http://localhost:8000/profiles \
  -H "Content-Type: application/json" \
  -d '{"name": "Ravi", "color": "#6366f1"}'
curl http://localhost:8000/analytics/summary?profile_id=1
```

Open `http://localhost:8000/docs` — FastAPI auto-generates interactive API docs. Test every endpoint here before moving on.

**Do not proceed to Phase 2 until all endpoints return correct responses.**

---

## Phase 2 — Chrome Extension

**Goal:** A popup that detects job listing pages, auto-fills a form, and saves to the backend.

### Step 2.1 — Extension scaffold

```bash
cd job-tracker/extension
```

The extension needs icons. Create placeholder PNGs or use any 16×16, 48×48, 128×128 images named `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder.

### Step 2.2 — Claude Code prompt (extension)

```bash
cd job-tracker/extension
claude
```

**Claude Code Prompt — Extension:**

```
Build a Chrome Manifest V3 browser extension for a job application tracker.

ARCHITECTURE:
- manifest.json with permissions: storage, activeTab, scripting, host_permissions for localhost:8000
- service_worker.js — background script: handles messages from popup and content scripts,
  makes all fetch() calls to localhost:8000 (avoids CORS issues from content scripts)
- scraper.js — content script injected on job board pages: extracts job data, sends to popup
- Site-specific scrapers in content/sites/ for LinkedIn, Naukri, Indeed, Greenhouse
- popup.html/js/css — the main UI the user sees when clicking the extension icon

SCRAPER LOGIC (content/scraper.js):
Detect which site the user is on by checking window.location.hostname.
Import the right site scraper and call extract() which returns:
  { company, title, url, location, work_type, salary_min, salary_max, source, job_description }

work_type detection (apply to all scrapers):
  Priority 1 — dedicated field: look for explicit Remote/Hybrid/On-site badges or labels
  Priority 2 — keyword scan of job description text:
    'remote' → 'remote'
    'hybrid' → 'hybrid'  
    'on-site' or 'onsite' or 'in-office' or 'in office' → 'onsite'
  Default to 'unknown' if nothing found. Match is case-insensitive.

Site-specific selectors:
- LinkedIn (linkedin.com/jobs): 
    title: .job-details-jobs-unified-top-card__job-title
    company: .job-details-jobs-unified-top-card__company-name
    location: .job-details-jobs-unified-top-card__bullet
    work_type: .job-details-jobs-unified-top-card__workplace-type (text: Remote/Hybrid/On-site)
    description: .jobs-description__content
- Naukri (naukri.com):
    title: .jd-header-title, h1.title
    company: .jd-header-comp-name, .comp-name
    location: .loc, .location
    work_type: look for "Work from home", "Remote", "Hybrid", "Work from office" text in .other-details
    salary: .salary (parse range like "8-12 Lacs" into min/max integers in lakhs*100000)
- Indeed (indeed.com):
    title: .jobsearch-JobInfoHeader-title
    company: [data-testid="inlineHeader-companyName"]
    location: [data-testid="job-location"]
    work_type: [data-testid="workplace-type"] or keyword scan fallback
- Greenhouse (boards.greenhouse.io):
    title: h1.app-title
    company: from URL path segment
    location: .location
    work_type: keyword scan of .content description

All scrapers should return nulls for fields they can't find — never crash.

POPUP UI (popup.html/js/css):
Dimensions: 380px wide, max 600px tall, scrollable.
Design: Clean, minimal, dark-themed. Professional.

Sections:
1. HEADER — App name "JobTrack" + current active profile displayed prominently
2. PROFILE SELECTOR — dropdown to switch active profile (fetched from GET /profiles)
   Active profile stored in chrome.storage.local as { activeProfileId, activeProfileName }
3. JOB FORM — pre-filled from scraper, all fields editable:
   - Company (text input, required)
   - Job Title (text input, required)  
   - Location (text input)
   - Work Type (dropdown: remote, hybrid, onsite, unknown — auto-detected from scraper)
   - Salary Min / Max (number inputs, side by side)
   - Currency (dropdown: INR, USD, GBP, EUR, AED)
   - Status (dropdown: wishlist, applied, screening, interview, offer, rejected, ghosted)
   - Source (auto-detected, editable dropdown)
   - Applied Date (date input, defaults to today)
   - Notes (textarea, 3 rows)
4. SAVE BUTTON — "Save to [Profile Name]" — posts to POST /jobs
   Show success state (green checkmark) or error state with message
5. FOOTER — small link: "Open Dashboard →" opens localhost:5173 in new tab

BEHAVIOR:
- On popup open: fetch profiles, restore active profile from storage, run scraper on active tab
- If not on a job site: show message "Navigate to a job listing to auto-fill" but keep form usable
- Profile switch: update chrome.storage.local immediately, re-label save button
- After successful save: show "Saved! ✓" for 2 seconds, then reset or close
- Validation: require company and title before saving

SERVICE WORKER (background/service_worker.js):
Handle message types:
  SAVE_JOB    → POST /jobs to localhost:8000
  GET_PROFILES → GET /profiles from localhost:8000
  MOVE_JOBS   → PATCH /jobs/move
All responses forwarded back to popup via sendResponse.
```

---

### Step 2.3 — Load the extension in Chrome

```
1. Open Chrome → chrome://extensions
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the job-tracker/extension/ folder
5. The JobTrack icon should appear in your toolbar
```

**Testing checklist:**
- Click extension icon — popup opens
- Profile dropdown shows profiles from backend
- Navigate to a LinkedIn job — form auto-fills
- Save a job — appears in `GET /jobs?profile_id=1`
- Switch profile — save button label updates

---

## Phase 3 — Dashboard

**Goal:** A full-featured React dashboard — Kanban view, list view, insights, profile management.

### Step 3.1 — Bootstrap the dashboard

```bash
cd job-tracker
npm create vite@latest dashboard -- --template react-ts
cd dashboard
npm install
npm install axios zustand react-router-dom recharts @tanstack/react-query
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 3.2 — Claude Code prompt (dashboard — Part 1: foundation)

Build the dashboard in two Claude Code sessions to manage complexity.

```bash
cd job-tracker/dashboard
claude
```

**Claude Code Prompt — Dashboard Part 1 (Foundation + Layout + API layer):**

```
Build the foundation of a React + TypeScript + Tailwind CSS dashboard for a job tracker app.
Backend is at http://localhost:8000. 

DESIGN DIRECTION:
Sophisticated, editorial aesthetic. Dark theme as default (#0f0f0f background).
Typography-forward — use a strong display font for headings, clean mono for stats.
Accent color: #6366f1 (indigo). Status colors: consistent semantic palette.
No generic SaaS look — think Bloomberg terminal meets Linear.app.
Subtle grid lines in the background. Numbers should feel data-rich.

PART 1: Build these foundational pieces:

1. src/types/index.ts
   Export all shared types:
   Profile { id, name, color, created_at }
   Job { id, profile_id, company, title, url, location, work_type,
         salary_min, salary_max, currency, status, source, applied_date,
         notes, job_description, created_at, updated_at, status_history: StatusHistory[] }
   StatusHistory { id, job_id, old_status, new_status, changed_at, note }
   AnalyticsSummary { total, by_status: Record<string,number>, response_rate }
   Status enum: 'wishlist' | 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'ghosted'
   WorkType enum: 'remote' | 'hybrid' | 'onsite' | 'unknown'

2. src/api/client.ts
   Axios instance with baseURL http://localhost:8000
   Exported functions (all typed):
     getProfiles(), createProfile(data), updateProfile(id, data), deleteProfile(id)
     getJobs(params: {profile_id?, status?, work_type?, search?, sort_by?, order?})
     getJob(id), createJob(data), updateJob(id, data), deleteJob(id)
     moveJobs(job_ids: number[], target_profile_id: number)
     getAnalyticsSummary(profile_id), getTimeline(profile_id),
     getLocations(profile_id), getSalary(profile_id), getSources(profile_id),
     getWorkTypes(profile_id)
     exportCSV(profile_id), exportJSON(profile_id)
     importJSON(data)

3. src/store/profileStore.ts
   Zustand store:
     state: { activeProfile: Profile | null, profiles: Profile[] }
     actions: setActiveProfile(profile), setProfiles(profiles), 
               loadProfiles() — fetches from API and sets both lists and restores
               last active from localStorage key 'jobtrack_active_profile_id'

4. src/components/ProfileSwitcher.tsx
   Dropdown showing all profiles with colored avatar dots.
   Clicking a profile sets it as active in the store + persists to localStorage.
   "+ New Profile" option at the bottom opens an inline form (name + color picker).
   Show active profile name prominently. Animate the dropdown open/close.

5. src/components/layout/AppShell.tsx
   Full app layout:
   - Left sidebar (240px): App logo "JobTrack", nav links (Dashboard, Applications,
     Insights, Settings), ProfileSwitcher at the bottom, small "Backend: connected" 
     status dot that pings GET /profiles on mount
   - Main content area: router outlet
   - Top bar: page title, search input (global, filters jobs list), action buttons

6. src/App.tsx
   React Router setup with routes:
     /          → Dashboard page
     /applications → Applications page  
     /insights  → Insights page
     /settings  → Settings page
   Wrap with QueryClientProvider (TanStack Query) and load profiles on mount.
```

---

**Claude Code Prompt — Dashboard Part 2 (Pages + Components):**

```
Continue building the job tracker dashboard. Foundation, types, API client, 
store, and AppShell are already built.

Build these pages and components:

PAGE 1: Dashboard (src/pages/Dashboard.tsx)
Two sections side by side on wide screens, stacked on narrow:

Section A — Stats strip at top (4 cards in a row):
  Total Applications | Active Pipeline | Response Rate | This Week

Section B — Kanban board:
  Columns for each status: Wishlist, Applied, Screening, Interview, Offer, Rejected, Ghosted
  Each column shows count badge and job cards.
  JobCard component shows: company name, job title, location, work type badge
  (🌐 Remote / 🏢 On-site / 🔀 Hybrid — omit if unknown), days since applied,
  salary range if available, colored status pill.
  Clicking a card opens JobDetailPanel (slide-in from right, 400px wide).
  Drag is NOT required — click to move status via a dropdown inside the detail panel.

PAGE 2: Applications (src/pages/Applications.tsx)
Full list view with:
  - Filter bar: status multi-select, work type filter (Remote/Hybrid/On-site/Unknown
    as toggle chips), source filter, search input, date range
  - Sort: by date, company, status
  - Table with columns: Company, Title, Location, Work Type, Salary, Status, Source, Applied Date, Actions
  - Checkbox column for bulk selection
  - Bulk action bar (appears when items selected): "Move to profile…" button → MoveJobsModal
  - Row click → JobDetailPanel slide-in
  - Inline status change via dropdown in the row

MoveJobsModal component:
  Shows count of selected jobs.
  Dropdown of all profiles (excluding current).
  Confirm button → calls PATCH /jobs/move → shows UndoToast.

UndoToast component:
  Fixed bottom-right, appears for 8 seconds.
  "Moved 3 jobs to Ravi's profile. Undo"
  Undo calls PATCH /jobs/move back to original profile_id.
  Auto-dismiss with progress bar.

JobDetailPanel component (used in both pages):
  Slide-in panel from right side.
  Shows: full job details, editable inline fields, status change dropdown,
  work type dropdown (remote/hybrid/onsite/unknown), status timeline (from status_history),
  notes textarea (auto-save on blur), "Open listing" link,
  "Delete job" button (with confirm).
  Close button or click-outside dismisses.

PAGE 3: Insights (src/pages/Insights.tsx)
Five charts using Recharts, all scoped to active profile:

Chart 1 — Application Timeline (LineChart)
  X axis: week labels (last 12 weeks). Y axis: count.
  Shows applications sent per week.

Chart 2 — Status Breakdown (PieChart or DonutChart)
  Segments per status. Click segment filters Applications page.

Chart 3 — Work Type Breakdown (DonutChart or HorizontalBarChart)
  Segments: Remote / Hybrid / On-site / Unknown.
  Colors: Remote=teal, Hybrid=indigo, On-site=amber, Unknown=gray.
  Show percentage labels. Handle gracefully when all jobs are 'unknown'.

Chart 4 — Top Locations (HorizontalBarChart)
  Top 8 locations by application count.

Chart 5 — Salary Distribution (BarChart or RangeChart)
  Shows salary_min to salary_max ranges, or a distribution if enough data.
  Handle gracefully when most jobs have no salary data.

Above the charts: a summary strip with key numbers (same 4 stats as Dashboard),
plus a work type quick-stat showing Remote % of total applications.

PAGE 4: Settings (src/pages/Settings.tsx)
Three sections:

Section 1 — Profiles
  List all profiles with edit (rename, change color) and delete controls.
  Delete disabled if profile has jobs (show tooltip explaining why).
  Add new profile form.

Section 2 — Data
  Export buttons: "Export CSV" and "Export JSON" (for active profile).
  Import JSON button: file picker → reads JSON → POST /import/json.
  Shows last export timestamp if stored.

Section 3 — About
  Version, backend URL, total jobs across all profiles.

STYLE REQUIREMENTS across all pages:
- Status colors consistent: wishlist=gray, applied=indigo, screening=amber, 
  interview=blue, offer=green, rejected=red, ghosted=gray/muted
- Empty states: friendly illustration-free messages with action buttons
- Loading states: skeleton loaders, not spinners
- All data mutations use TanStack Query mutations with optimistic updates where possible
- Responsive: works at 1280px+ (primary) and degrades gracefully to 900px
```

---

### Step 3.3 — Run the dashboard

```bash
cd job-tracker/dashboard
npm run dev
# Opens at http://localhost:5173
```

**Testing checklist:**
- Profile switcher shows profiles, persists selection on refresh
- Kanban board populates from backend, work type badge shows on cards where detected
- Adding a job via extension appears on dashboard (may need refresh or polling)
- Work type auto-detected on LinkedIn/Naukri, falls back to 'unknown' cleanly
- Status change in panel writes to backend + updates status_history
- Move jobs modal works, undo toast appears
- All 5 Insights charts render (even with minimal data)
- Work Type filter chips on Applications page correctly filter the list
- Export downloads a real CSV/JSON file (work_type column included)

---

## Phase 4 — Integration & Polish

**Goal:** Make all three parts work seamlessly together.

### Step 4.1 — Real-time feel (optional but recommended)

The dashboard won't auto-refresh when the extension saves a job. Three options (pick one):

**Option A — Manual refresh button** (simplest)
Add a refresh icon in the top bar that re-fetches jobs. TanStack Query makes this one line.

**Option B — Polling** (easy)
In `useJobs`, add `refetchInterval: 10000` to TanStack Query. Polls every 10 seconds.

**Option C — WebSocket** (most real-time)
Add a WebSocket endpoint to FastAPI. Extension pings it on save. Dashboard listens and refetches.
Overkill for a local tool — only do this if Option B feels too slow.

**Recommendation: Start with Option B.** It's two lines of code and works fine locally.

### Step 4.2 — Claude Code prompt (polish pass)

```
Review the job tracker extension popup and dashboard for these issues and fix them:

1. EXTENSION: If localhost:8000 is not running, show a clear error in the popup
   ("Backend not running. Start it with: python run.py") instead of a broken state.

2. EXTENSION: After saving a job, if the same URL already exists for the active profile,
   ask the user: "This job is already saved. Update it or save as new?"

3. DASHBOARD: Implement TanStack Query refetchInterval: 15000 on the jobs query so
   the dashboard auto-refreshes when the extension saves new jobs.

4. DASHBOARD: Add keyboard shortcuts:
   Cmd+K — focus global search
   Escape — close any open panel/modal
   N — open "Add job manually" modal (pre-filled blank form, same as extension popup form)

5. DASHBOARD: Add a "Add job manually" button/modal for jobs not found via extension.
   Same fields as extension form.

6. GENERAL: Add a seed check — if no profiles exist on first run, auto-create a
   "Default" profile and show a welcome banner explaining how to add more.
```

---

### Step 4.3 — Start script

Create `job-tracker/start.sh` for one-command startup:

```bash
#!/bin/bash
echo "Starting JobTrack backend..."
cd backend && source venv/bin/activate && python run.py &
BACKEND_PID=$!

sleep 2
echo "Starting JobTrack dashboard..."
cd dashboard && npm run dev &
DASHBOARD_PID=$!

echo ""
echo "✓ Backend running at http://localhost:8000"
echo "✓ Dashboard running at http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $DASHBOARD_PID" EXIT
wait
```

```bash
chmod +x job-tracker/start.sh
./job-tracker/start.sh
```

---

## Phase 5 — Email Integration (Future)

Table this for now. When ready, here is the plan:

### What you'll need
- Google Cloud Console project with Gmail API enabled
- OAuth 2.0 credentials (client_id, client_secret) stored in a local `.env` file
- `google-auth-oauthlib` and `google-api-python-client` Python packages

### How it works
A background poller runs every 15 minutes (via `asyncio` scheduled task in FastAPI):
1. Fetches last 50 emails from Gmail API
2. For each email, checks subject + sender against known company names in your jobs table
3. Classifies the email using a simple keyword classifier (or Claude API call for accuracy):
   - Rejection keywords: "unfortunately", "decided to move forward with other", "not moving forward"
   - Interview keywords: "interview", "schedule a call", "speak with you"
   - Offer keywords: "offer", "pleased to inform", "compensation"
4. If matched: updates job status, inserts email_matches row, logs to status_history
5. Dashboard shows an "Email activity" section on the job detail panel

### Claude Code prompt (when ready)
```
Add Gmail integration to the FastAPI backend.
Add a /email/setup endpoint that initiates Gmail OAuth flow.
Add a /email/sync endpoint that scans recent emails and auto-updates job statuses.
Add a background task that runs sync every 15 minutes when the server is running.
Store OAuth tokens in backend/tokens.json (add to .gitignore).
Use the email_matches table to record all matches.
Update status_history with note "Auto-updated from email: [subject]".
```

---

## Claude Code Best Practices for This Project

### General tips

- **One phase at a time.** Don't start Phase 2 until Phase 1 is fully working and tested.
- **Test at each step.** The curl commands and checklists in each phase are not optional — they catch problems before they compound.
- **Iterate with Claude Code.** If generated code has bugs, describe the specific error and ask for a fix. Don't rewrite from scratch.
- **Use `/docs` heavily.** FastAPI's auto-generated docs at `localhost:8000/docs` let you test every endpoint interactively without writing curl commands.

### Prompting Claude Code effectively

When something is wrong, give Claude Code the error message, the relevant file, and what you expected. Example:

> "The profile switcher dropdown in the extension popup is not saving the selection. When I close and reopen the popup, it resets to the first profile. Here's popup.js [paste]. I expected it to use chrome.storage.local to persist the selection."

When you want a new feature added to existing code:

> "In the Applications page, add a 'Ghosted' filter button. Ghosted means jobs where status is 'applied' and applied_date is more than 30 days ago with no status update. Add this as a computed filter on the frontend, not a backend change."

### Keeping context across sessions

Claude Code loses context between sessions. At the start of each new session, paste this:

> "I'm building a local job tracker with three parts: FastAPI backend (localhost:8000, SQLite), Chrome extension (Manifest V3), and React dashboard (Vite, localhost:5173). Multi-profile system, no auth. [Then describe what you're working on today.]"

---

## Estimated Timeline

Working in focused sessions with Claude Code:

| Phase | Effort | Notes |
|---|---|---|
| Phase 1 — Backend | 2–3 hours | Most is generated; main effort is testing |
| Phase 2 — Extension | 3–4 hours | Site scrapers need manual tuning per site |
| Phase 3 — Dashboard | 4–6 hours | Largest phase, split into two sessions |
| Phase 4 — Polish | 1–2 hours | Mostly prompt-driven fixes |
| **Total** | **10–15 hours** | Spread across multiple days |

---

## Common Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| CORS errors in extension | Extension origin not whitelisted | Add `chrome-extension://*` to FastAPI CORS |
| Scraper returns nulls | Site updated their HTML | Inspect element, update selectors in site scraper |
| Dashboard not updating | No polling set up | Add `refetchInterval` to TanStack Query |
| Port already in use | Old process still running | `lsof -i :8000` then `kill <PID>` |
| Extension not loading | Manifest V3 syntax error | Check Chrome error in chrome://extensions |
| SQLite locked | Two processes writing simultaneously | Use `check_same_thread=False` in SQLAlchemy engine |

---

## Quick Reference — Key Commands

```bash
# Start backend
cd job-tracker/backend && source venv/bin/activate && python run.py

# Start dashboard
cd job-tracker/dashboard && npm run dev

# Start both
./job-tracker/start.sh

# Run seed data
cd job-tracker/backend && python seed.py

# Test backend health
curl http://localhost:8000/profiles

# Open API docs
open http://localhost:8000/docs

# Open dashboard
open http://localhost:5173

# Load extension
# Chrome → chrome://extensions → Load unpacked → select extension/
```
