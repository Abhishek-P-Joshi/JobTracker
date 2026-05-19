# Building JobTrack: A Full-Stack Job Application Tracker from Scratch

> A deep-dive into the design decisions, architecture, and trade-offs behind a personal job-tracking system built with FastAPI, a Chrome Extension (MV3), and a React dashboard.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [System Overview](#system-overview)
3. [Tech Stack](#tech-stack)
4. [Phase 1 — The Backend](#phase-1--the-backend)
5. [Phase 2 — The Chrome Extension](#phase-2--the-chrome-extension)
6. [Phase 3 — The Dashboard](#phase-3--the-dashboard)
7. [Phase 4 — Polish & Integration](#phase-4--polish--integration)
8. [Data Model](#data-model)
9. [Key Design Decisions & Trade-offs](#key-design-decisions--trade-offs)
10. [Security Considerations](#security-considerations)
11. [What's Next](#whats-next)

---

## The Problem

Job hunting generates a surprising amount of data — companies you've applied to, roles you're tracking, screening calls, interviews, follow-ups, ghosting. Most people manage this with spreadsheets. The pain points are real:

- You have to manually copy-paste from job listings
- Spreadsheets don't give you pipeline metrics or trends
- There's no way to track status changes over time
- Switching between LinkedIn, Naukri, Indeed, and ATS portals is friction-heavy

The goal was to build a tool that feels invisible during the job search: one click to save a listing from any job board, a clean Kanban view to see your pipeline at a glance, and enough analytics to answer "am I applying enough?" without opening a spreadsheet.

---

## System Overview

JobTrack has three independent layers that communicate over localhost:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Chrome)                         │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────────┐ │
│  │   Chrome Extension   │      │   React Dashboard (Vite)     │ │
│  │   (Manifest V3)      │      │   http://localhost:5173      │ │
│  │                      │      │                              │ │
│  │  ┌────────────────┐  │      │  ┌──────────┐  ┌─────────┐  │ │
│  │  │ Content Script │  │      │  │  Kanban  │  │ Charts  │  │ │
│  │  │ (site scrapers)│  │      │  └──────────┘  └─────────┘  │ │
│  │  └───────┬────────┘  │      │  ┌──────────┐  ┌─────────┐  │ │
│  │          │ message   │      │  │  Table   │  │Settings │  │ │
│  │  ┌───────▼────────┐  │      │  └──────────┘  └─────────┘  │ │
│  │  │Service Worker  │  │      │                              │ │
│  │  │ (message bus)  │  │      │   React Query ←→ Zustand     │ │
│  │  └───────┬────────┘  │      └──────────────┬───────────────┘ │
│  │          │ fetch     │                      │ axios           │
│  └──────────┼───────────┘                      │                 │
└─────────────┼────────────────────────────────┬─┘                 │
              │                                │                   │
              └──────────────┐  ┌─────────────┘                   │
                             │  │                                  │
                    ┌────────▼──▼────────┐                         │
                    │   FastAPI Backend  │                         │
                    │  http://localhost  │                         │
                    │       :8000        │                         │
                    │                   │                         │
                    │  /profiles        │                         │
                    │  /jobs            │                         │
                    │  /analytics/*     │                         │
                    │  /export/*        │                         │
                    │  /import/*        │                         │
                    └────────┬──────────┘                         │
                             │ SQLAlchemy ORM                      │
                    ┌────────▼──────────┐                         │
                    │   SQLite (dev)    │                         │
                    │    jobs.db        │                         │
                    └───────────────────┘                         │
```

All three components run locally. The extension and dashboard both talk to the backend over HTTP — they never communicate directly with each other.

---

## Tech Stack

### Backend
| Layer | Technology | Why |
|---|---|---|
| Framework | FastAPI 0.115 | Auto-generated OpenAPI docs, Pydantic v2 validation, async-ready |
| ORM | SQLAlchemy 2.x (mapped_column style) | Type-safe models, no raw SQL needed for queries |
| Database | SQLite (dev) | Zero-config, single-file, trivially portable |
| Validation | Pydantic v2 | Field validators, model validators, automatic coercion |
| Server | Uvicorn + `--reload` | Fast ASGI server with hot-reload for development |

### Chrome Extension
| Layer | Technology | Why |
|---|---|---|
| Manifest | MV3 | Required for new Chrome extensions; service worker replaces background pages |
| Background | Service Worker | Persistent-free message bus; handles fetch calls to backend |
| Content Scripts | Vanilla JS | No build step needed; injected per-site for scraping |
| Site Scrapers | LinkedIn, Naukri, Indeed, Greenhouse | Covers the four most common job boards in India + global |

### Dashboard
| Layer | Technology | Why |
|---|---|---|
| Framework | React 19 + Vite 8 | Fast HMR, modern React features (concurrent mode) |
| Language | TypeScript (strict: true) | Full type safety across API contracts, hooks, components |
| Styling | Tailwind CSS v3 | Utility-first, no context switching between CSS and JSX |
| Server State | TanStack Query v5 | Caching, background refetch, optimistic updates out of the box |
| Client State | Zustand v5 (persisted) | Minimal boilerplate; activeProfileId survives page reload |
| Charts | Recharts v3 | Composable chart primitives built on SVG; pairs well with React |
| HTTP Client | Axios | Typed interceptors, automatic JSON parsing, response typing |
| Routing | React Router v7 (library mode) | BrowserRouter + Outlet pattern for nested layouts |

---

## Phase 1 — The Backend

### Architecture

The backend is a single FastAPI application with four routers:

```
app/
├── main.py          # CORS, router registration, startup event
├── database.py      # SQLAlchemy engine + session factory
├── models.py        # ORM models (Profile, Job, StatusHistory)
├── schemas.py       # Pydantic request/response schemas
└── routers/
    ├── profiles.py  # CRUD for profiles
    ├── jobs.py      # CRUD + move + duplicate guard
    ├── analytics.py # Aggregate queries (summary, timeline, locations, salary)
    └── export.py    # CSV/JSON export, JSON import
```

### The Data Model (brief)

Three tables: `profiles`, `jobs`, `status_history`. Every time a job's status changes, a `StatusHistory` row is written automatically — giving users a full audit trail of their pipeline progression.

### Analytics Endpoints

Rather than computing analytics on the frontend, we push aggregations to the backend. This keeps the dashboard lightweight and makes analytics queries fast even with large datasets:

- `GET /analytics/summary` — total jobs, count by status, response rate
- `GET /analytics/timeline` — weekly application volume (line chart)
- `GET /analytics/locations` — jobs grouped by location (bar chart)
- `GET /analytics/salary` — min/avg/max across jobs with salary data
- `GET /analytics/work-types` — remote/hybrid/on-site breakdown

### Key Design Decision: SQLite for Development

SQLite was chosen deliberately over PostgreSQL. This is a local-first tool — it runs on your machine, stores your data locally, and doesn't require a database server. The trade-off is that SQLite has limited concurrency support (fine for a single-user app) and lacks some PostgreSQL features like partial indexes and full-text search. A `UniqueConstraint` added to the model for duplicate URL protection relies on SQLite's NULL semantics (`NULL != NULL`) to correctly allow multiple null-URL jobs per profile.

---

## Phase 2 — The Chrome Extension

### Architecture

MV3 extensions can't run persistent background pages. Instead, they use a **service worker** that sleeps when idle and wakes on demand.

```
Tab (Job Listing Page)
│
│  SCRAPE_JOB message
│
▼
Content Script (scraper.js)
│   ├── linkedin.js  → extracts title, company, location, salary, URL
│   ├── naukri.js    → same; handles INR salary formats
│   ├── indeed.js    → same; reads data-testid salary attributes
│   └── greenhouse.js → handles ATS job pages
│
│  result: { title, company, location, workType, salary, currency, url }
│
▼
Popup (popup.js)
│   ├── Renders pre-filled form for user review
│   ├── Profile selector (persisted via chrome.storage.local)
│   └── Handles duplicate warnings (409 → amber hint)
│
│  SAVE_JOB message
│
▼
Service Worker (service_worker.js)
│   ├── GET_PROFILES  → GET  /profiles
│   ├── SAVE_JOB      → POST /jobs  (handles 409 separately from other errors)
│   └── MOVE_JOBS     → PATCH /jobs/move
│
▼
FastAPI Backend
```

### Salary Parsing

One non-trivial piece: salary data appears in wildly different formats across job boards. We built a centralized `parseSalary()` function in `scraper.js` that handles:

- **INR Crore format**: `"1.2 – 2.5 Cr"` → min: 12,000,000 / max: 25,000,000
- **INR Lacs format**: `"8 – 15 LPA"` → min: 800,000 / max: 1,500,000
- **CAD format**: `"CA$120K – CA$160K"` → min: 120,000 / max: 160,000 (currency: CAD)
- **USD format**: `"$140,000 – $180,000"` → min: 140,000 / max: 180,000 (currency: USD)

The critical ordering rule: **check for Crore before Lacs** — otherwise a `"1 Cr"` value gets parsed as `"100 Lacs"`, a 100× undercount.

### Key Design Decision: MV3 Service Worker vs MV2 Background Page

Manifest V3 replaced persistent background pages with ephemeral service workers. The trade-off:
- **MV2 background pages** stay loaded indefinitely — easy to maintain state, but Chrome is deprecating them
- **MV3 service workers** wake on demand — Chrome can terminate them at any time, so you can't keep local state

Our solution: the service worker is stateless. It's a pure message proxy — receives a message, makes one or more fetch calls, returns the result. All persistent state (active profile ID) lives in `chrome.storage.local`, and all application data lives in the backend.

---

## Phase 3 — The Dashboard

### Component Architecture

```
App.tsx
└── ErrorBoundary
    └── QueryClientProvider
        └── BrowserRouter
            └── AppShell (sidebar layout)
                ├── Sidebar
                │   ├── NavLinks (Dashboard, Applications, Insights, Settings)
                │   ├── AddJobModal trigger + keyboard shortcut handler
                │   └── ProfileSwitcher (Zustand → activeProfileId)
                └── <Outlet /> (active page)
                    ├── Dashboard.tsx
                    │   ├── StatCards (total, active pipeline, response rate, this week)
                    │   └── KanbanBoard → JobCard × N columns
                    ├── Applications.tsx
                    │   ├── Filter bar (search, status chips, work type chips, sort)
                    │   ├── Jobs table with bulk select
                    │   └── MoveJobsModal + UndoToast
                    ├── Insights.tsx
                    │   ├── ApplicationTimeline (LineChart)
                    │   ├── StatusBreakdown (PieChart)
                    │   ├── TopLocations (horizontal BarChart)
                    │   ├── SalaryDistribution (BarChart)
                    │   └── WorkTypeBreakdown (PieChart)
                    └── Settings.tsx
                        ├── Profile CRUD (name, color picker)
                        └── Export CSV / JSON, Import JSON
```

### State Management: Two Layers

The dashboard separates state into two distinct concerns:

**Server state** (TanStack Query):
- All job data, analytics, profiles from the backend
- 15-second background refetch on jobs (stays in sync with extension saves)
- 30-second stale time on analytics (expensive aggregations)
- All mutations invalidate `['jobs']` and `['analytics']` cache keys

**Client state** (Zustand, persisted):
- `activeProfileId` — survives page reload via `localStorage`
- `profiles` array — hydrated at startup from `/profiles`, updated on CRUD
- `isLoading` / `error` — for first-run experience and error display

```
┌─────────────────────────────────────────────────────┐
│                    React Component                  │
│                                                     │
│  useProfile()          useJobs(profileId)           │
│       │                       │                     │
│       ▼                       ▼                     │
│  ┌─────────────┐     ┌────────────────────┐        │
│  │   Zustand   │     │   TanStack Query   │        │
│  │  (persisted)│     │  ['jobs', id, {}]  │        │
│  │             │     │  ['analytics', id] │        │
│  │ profiles[]  │     │  ['job', id]       │        │
│  │ activeId    │     └────────┬───────────┘        │
│  └─────────────┘              │ stale? → refetch   │
│                               ▼                    │
│                          axios → FastAPI           │
└─────────────────────────────────────────────────────┘
```

### Key Design Decision: Granular Zustand Selectors

A subtle React performance issue: subscribing to the entire Zustand store causes a re-render on any store change — including `isLoading` flipping to `false`. By using per-field selectors, components only re-render when the specific fields they care about change:

```ts
// ✗ Subscribes to every store field
const { profiles, activeProfileId } = useProfileStore();

// ✓ Each selector independently memoized
const profiles = useProfileStore((s) => s.profiles);
const activeProfileId = useProfileStore((s) => s.activeProfileId);
```

This becomes important in `useProfile()` — called by almost every page — where unnecessary re-renders would cascade.

### Key Design Decision: React Query Key Structure

Query keys are structured hierarchically so cache invalidation can be scoped:

```ts
['jobs', profileId, filters]     // list — invalidated by mutations
['job', id]                      // single — invalidated on update + removed on delete
['analytics', 'summary', id]     // invalidated whenever jobs change
['analytics', 'timeline', id]
```

When any mutation succeeds, we invalidate `['jobs']` and `['analytics']` using prefix matching — a single `invalidateQueries({ queryKey: ['analytics'] })` call invalidates all five analytics queries for all profiles.

---

## Phase 4 — Polish & Integration

### Duplicate URL Guard

A three-layer duplicate detection system ensures the same job listing is never saved twice to the same profile:

```
User tries to save a job
         │
         ▼
┌──────────────────────┐
│  Pydantic validator  │  ← normalises URL (lowercase scheme+host, strip whitespace)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Application layer   │  ← SELECT exists WHERE profile_id=? AND url=?
│  (router guard)      │  → 409 { message, job_id, company, title }
└──────────┬───────────┘
           │ (concurrent writes only)
           ▼
┌──────────────────────┐
│  Database layer      │  ← UniqueConstraint("profile_id", "url")
│  UniqueConstraint    │  → IntegrityError → 500 (last resort)
└──────────────────────┘
```

The 409 response carries enough context (`company`, `title`) for the client to display a meaningful "already saved" message, not just an error code.

### Keyboard Shortcuts: The Stale Closure Problem

The first implementation of keyboard shortcuts registered a new `document.addEventListener` on every render because the callbacks were inline arrow functions:

```ts
// ✗ Effect re-runs on every render; stale closures
useEffect(() => {
  const handler = (e) => { if (e.key === 'n') onAddJob(); }; // captures stale onAddJob
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [onAddJob]); // onAddJob is a new function reference every render
```

The fix uses refs to hold the latest callback while the listener is registered exactly once:

```ts
// ✓ Listener registered once; always reads the latest callback via ref
const onAddJobRef = useRef(onAddJob);
useEffect(() => { onAddJobRef.current = onAddJob; }, [onAddJob]);

useEffect(() => {
  const handler = (e) => { onAddJobRef.current?.(); };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []); // empty dep array — registers once
```

This pattern is common enough to be worth naming: **event listener with ref-stable callbacks**.

### First-Run Experience

The dashboard detects the first-run state by checking `profiles.length === 0` **after** the initial data load completes. Checking during load would cause a flash of the welcome screen even for returning users. The check is:

```ts
if (!activeProfileId) {
  if (isLoading) return <div />; // blank during hydration — no flash
  if (profiles.length === 0) return <WelcomeScreen />;
  return <NoProfileSelected />;
}
```

---

## Data Model

```
┌──────────────────────────────────────────────────────────────────┐
│                           profiles                               │
├──────────────┬─────────────────────────────────────────────────┤
│ id           │ INTEGER PRIMARY KEY                              │
│ name         │ VARCHAR NOT NULL UNIQUE                          │
│ color        │ VARCHAR DEFAULT '#6366f1'                        │
│ created_at   │ DATETIME DEFAULT utc_now()                       │
└──────────────┴──────────────────────────────────────────────────┘
        │
        │ 1:many
        │
┌───────▼──────────────────────────────────────────────────────────┐
│                             jobs                                 │
├──────────────┬──────────────────────────────────────────────────┤
│ id           │ INTEGER PRIMARY KEY                              │
│ profile_id   │ INTEGER FK → profiles.id                         │
│ company      │ VARCHAR NOT NULL                                  │
│ title        │ VARCHAR NOT NULL                                  │
│ url          │ VARCHAR (unique per profile when non-null)        │
│ location     │ VARCHAR                                           │
│ work_type    │ VARCHAR  [remote|hybrid|onsite|unknown]           │
│ salary_min   │ INTEGER (annual, in base currency unit)           │
│ salary_max   │ INTEGER                                           │
│ currency     │ VARCHAR  [INR|USD|CAD|GBP|EUR|SGD]               │
│ status       │ VARCHAR  [wishlist|applied|screening|interview|   │
│              │           offer|rejected|ghosted]                │
│ source       │ VARCHAR  [linkedin|naukri|indeed|greenhouse|null] │
│ applied_date │ DATE                                              │
│ notes        │ TEXT                                              │
│ job_description│ TEXT                                           │
│ created_at   │ DATETIME                                          │
│ updated_at   │ DATETIME (auto-updated via SQLAlchemy event)      │
└──────────────┴──────────────────────────────────────────────────┘
        │
        │ 1:many (cascade delete)
        │
┌───────▼──────────────────────────────────────────────────────────┐
│                        status_history                            │
├──────────────┬──────────────────────────────────────────────────┤
│ id           │ INTEGER PRIMARY KEY                              │
│ job_id       │ INTEGER FK → jobs.id ON DELETE CASCADE            │
│ old_status   │ VARCHAR (null for initial status)                 │
│ new_status   │ VARCHAR                                           │
│ changed_at   │ DATETIME                                          │
│ note         │ TEXT                                              │
└──────────────┴──────────────────────────────────────────────────┘
```

**Salary storage convention**: all salary values are stored in the full annual amount in the base unit (rupees, dollars, etc.). Display formatting happens in the frontend — `₹12L` is displayed as `₹1,200,000 / 100,000 = 12L` by the `fmt()` function in `JobCard`.

---

## Key Design Decisions & Trade-offs

### 1. Local-First, Single-User Architecture

**Decision**: Everything runs on localhost. No cloud backend, no auth, no multi-user support.

**Why**: This is a personal productivity tool. Cloud hosting adds operational complexity (database provisioning, auth, costs, uptime) that provides no value for a single user. The tradeoff is that data isn't synced across machines — but most job searching happens from one primary machine anyway.

**Consequence**: SQLite is a natural fit. No connection pooling needed, zero configuration, database is a single file you can back up or version control.

---

### 2. Chrome Extension → Service Worker → Backend (No Direct DOM-to-Backend)

**Decision**: Content scripts never call the backend directly. They post a message to the service worker, which makes the fetch call.

**Why**: MV3 content scripts run in the page's context with limited permissions. The service worker has the `host_permissions` to call `localhost:8000`. More importantly, this keeps the content scripts' only job as scraping — they never need to know about profiles or API tokens.

**Consequence**: A two-hop architecture (content script → service worker → backend). The extra message-passing latency is imperceptible (~1ms), and the separation of concerns makes testing each layer independently much easier.

---

### 3. Profiles as First-Class Entities

**Decision**: Every job belongs to a profile. There's no "global" job list.

**Why**: Job searchers often have multiple active searches with different criteria — "SWE roles in Bangalore", "remote-only", "startup vs enterprise". Profiles let you segment pipelines without mixing data. Analytics are always scoped to a profile, so the charts reflect one coherent search strategy.

**Consequence**: The UI has a profile switcher in every view. All API calls include `?profile_id=N`. The active profile is persisted to `localStorage` via Zustand so switching tabs doesn't reset your context.

---

### 4. Status History as an Append-Only Log

**Decision**: Rather than just storing the current status, we write a `StatusHistory` row on every status change.

**Why**: The progression from `applied → screening → interview → offer` is the most valuable data in a job search. Knowing that you got to final-round interviews at 8 companies but got rejections at that stage tells you something specific about your pitch. A simple status field would lose this permanently.

**Consequence**: The `updated_at` timestamp on jobs is maintained by a SQLAlchemy `before_update` event hook rather than manually, to ensure it's never forgotten.

---

### 5. React Query for Server State, Zustand Only for UI State

**Decision**: Don't put API data in Zustand. Keep Zustand for UI-only concerns (active profile, modal state).

**Why**: Mixing server state and client state in a single store creates synchronisation problems. React Query handles caching, background refetching, and invalidation natively. Zustand is great for UI state but not for "data that needs to stay in sync with a server".

**Consequence**: Profile data lives in Zustand (it's loaded once and mutated via CRUD), while job data and analytics live entirely in React Query caches. The dividing line: if the data can change from outside the browser (e.g., extension saves a job while the dashboard is open), it belongs in React Query.

---

### 6. Duplicate URL Detection: Application Layer + Database Layer

**Decision**: Implement duplicate detection at the Pydantic validator level, the application router level, and the database constraint level.

**Why**: Defense in depth. The Pydantic validator normalises URLs (lowercases scheme/host, strips whitespace) so that `https://LinkedIn.com/jobs/123` and `https://linkedin.com/jobs/123` are treated as the same URL. The router check surfaces a meaningful 409 with job details. The DB constraint is the final safety net for concurrent writes.

**Consequence**: Clients get a structured 409 response — not just a status code — so the UI can say "already saved as *Senior Engineer* at *Acme Corp*" rather than a generic error.

---

### 7. Manifest V3 Trade-offs

**Decision**: Build on MV3 despite its limitations.

**Why**: MV2 is deprecated. Any extension built on MV2 today is a maintenance liability.

**Key MV3 constraints encountered**:
- **No persistent background state**: solved by making the service worker stateless
- **`chrome.tabs.query` popup window bug**: without `lastFocusedWindow: true`, the query returns the popup window itself — fixed by adding the flag
- **Content script ordering**: all site files (`linkedin.js`, `naukri.js`, etc.) and `scraper.js` must be listed in the manifest; site files use `typeof scrapeX === 'function'` guards to handle partial loads gracefully

---

## Security Considerations

### Backend
- **Input validation**: all inputs validated by Pydantic before touching the database; no raw SQL, no f-string interpolation in queries
- **Sort field allowlist**: `sort_by` parameter validated against a `VALID_FIELDS` set to prevent ORM attribute injection
- **CORS**: restricted to `http://localhost:5173` and `chrome-extension://` origins; wildcard `*` was rejected during review
- **Status/work_type validation**: both fields validated against explicit sets rather than passed through to the DB

### Extension
- **`innerHTML` → DOM APIs**: the popup originally used `innerHTML` for rendering profiles; replaced with DOM methods to eliminate XSS vectors
- **`textContent` for option labels**: user-supplied profile names rendered with `textContent`, not `innerHTML`
- **`noopener noreferrer`**: all external links in the dashboard open with both flags

### Dashboard
- **URL scheme validation**: `job.url` is validated against `/^https?:\/\//` before being rendered as an anchor — prevents `javascript:` URLs from being clickable
- **No secrets in frontend**: the API base URL comes from `VITE_API_URL` env var with a localhost fallback — no tokens or credentials in the bundle

---

## What's Next

A few areas worth exploring as natural next steps:

**Tests** — No tests were written during initial development (deferred by design). The priority order would be: (1) Pydantic schema validators (pure functions, easy to test), (2) FastAPI endpoint integration tests with an in-memory SQLite DB, (3) React hook unit tests with `renderHook`, (4) E2E tests for the dashboard's critical paths.

**Code splitting** — The dashboard bundles to ~748KB. Recharts alone is significant. Dynamic `import()` for the Insights page (which is the only consumer of Recharts) would cut the initial load bundle substantially.

**Alembic migrations** — Currently the schema is managed by `create_all()`. Adding Alembic would make schema changes incremental and reversible, which matters once the database has real data.

**Offline-first extension** — The extension fails visibly if the backend isn't running. A small `IndexedDB` queue in the service worker could buffer saves and flush them when the backend is next available.

**Keyboard navigation in Kanban** — The Kanban board is fully pointer-driven. Adding `j/k` for card navigation and `Enter` to open the detail panel would make it keyboard-accessible.

**Email integration (Phase 5)** — The `EmailMatch` model is already scaffolded in the database. The idea: connect to Gmail via OAuth, parse subject/sender patterns to match incoming emails (interview invites, rejections) to tracked jobs, and auto-advance status.

---

## Running It

```bash
# Clone and set up
git clone <repo>
cd job-tracker

# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Dashboard
cd ../dashboard && npm install

# Launch everything
cd .. && ./start.sh
# → Backend:   http://localhost:8000/docs
# → Dashboard: http://localhost:5173

# Extension
# Open chrome://extensions → Load unpacked → select job-tracker/extension/
```

---

*Built iteratively across four phases — backend → extension → dashboard → polish. Each phase was reviewed for security, correctness, and React best practices before moving on.*
