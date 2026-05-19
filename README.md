# JobTrack

A local-first job application tracker. A Chrome extension scrapes job details from LinkedIn, Naukri, Indeed, and Greenhouse with one click. A React dashboard gives you a Kanban board, analytics, and full application history — all running on your machine with no accounts, no cloud, and no data leaving your computer.

---

## What's inside

```
job-tracker/
├── backend/      FastAPI + SQLite  (localhost:8000)
├── dashboard/    React + Vite      (localhost:5173)
└── extension/    Chrome MV3 extension
```

---

## Features

### Chrome Extension

- **One-click capture** — opens a popup on any supported job page and auto-fills title, company, location, salary, work type, and job description
- **LinkedIn Voyager API** — fetches structured data directly from LinkedIn's internal API for higher accuracy; falls back to DOM scraping if unavailable
- **Recommendations page support** — works on `/jobs/collections/recommended/` and other LinkedIn collection pages, not just direct job URLs
- **Supported sites** — LinkedIn, Naukri, Indeed, Greenhouse
- **Multi-profile** — switch between profiles in the popup; the active profile is remembered across sessions
- **Duplicate detection** — warns if the URL was already saved, shows the existing record

### Dashboard

**Kanban Board**
- 7 columns: Wishlist → Applied → Screening → Interview → Offer → Rejected → Ghosted
- Job cards show company, title, location, work type badge, days since applied, and salary range
- Click any card to open a slide-in detail panel

**Applications Table**
- Filter by status, work type, source, and free-text search
- Sort by date, company, or status
- Bulk-select and move jobs between profiles
- Undo toast with 8-second window

**Job Detail Panel**
- Inline editing for all fields
- Status timeline showing every transition with timestamps
- Notes with auto-save on blur
- Direct link to the original job listing
- Confirm-before-delete

**Insights (5 charts)**
- Application timeline — last 12 weeks
- Status breakdown — pie chart
- Work type breakdown — donut chart
- Top locations — horizontal bar
- Salary distribution — bar chart with min/max ranges

**Settings**
- Create, rename, and color-code profiles
- Export jobs as CSV or JSON
- Import from JSON
- Toggle keyboard shortcuts

**Keyboard shortcuts**
- `N` — add job manually
- `Cmd+K` — focus search
- `Escape` — close panels and modals
- `?` — show shortcuts reference

### Backend

- REST API with FastAPI; interactive docs at `localhost:8000/docs`
- SQLite database — no setup required, stored at `backend/jobs.db`
- Multi-profile isolation — all queries scoped to a profile
- Status history — every status change is recorded with a timestamp
- Duplicate URL guard — 409 response with the conflicting record's identity
- Analytics endpoints — summary, timeline, locations, salary, sources, work types
- CSV and JSON export; JSON import with bulk insert

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI 0.115, SQLAlchemy 2.0, Pydantic 2.9, SQLite |
| Dashboard | React 19, TypeScript 6, Vite 8, Tailwind CSS 3, TanStack Query 5, Zustand 5, Recharts 3 |
| Extension | Chrome Manifest V3, vanilla JS |

---

## Getting started

### Prerequisites

- Python 3.11+
- Node 20+
- Chrome (or any Chromium-based browser)

### 1 — Backend

```bash
cd job-tracker/backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
# → http://localhost:8000
```

Optionally seed sample data:

```bash
python seed.py
```

### 2 — Dashboard

```bash
cd job-tracker/dashboard
npm install
npm run dev
# → http://localhost:5173
```

### 3 — Start both at once

```bash
cd job-tracker
./start.sh
```

### 4 — Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `job-tracker/extension/` folder

The JobTrack icon will appear in your toolbar. Navigate to any supported job listing and click it.

---

## How it works

```
Job board page
      │
      │  content script scrapes job data
      ▼
Extension popup ──── chrome.runtime.sendMessage ────► Service worker
                                                            │
                                                            │  fetch()
                                                            ▼
                                                    FastAPI backend
                                                            │
                                                            │  SQLAlchemy
                                                            ▼
                                                       jobs.db (SQLite)
                                                            ▲
                                                            │  axios
                                                    React dashboard
```

The service worker handles all network calls to the backend — content scripts never fetch directly. This keeps CORS clean and the extension's responsibilities minimal: scrape and display, nothing more.

---

## Roadmap

### Resume Vault *(next)*

- Point the app at a local folder containing your resumes (`.pdf` and `.docx`)
- Designate one file as your **master resume** (comprehensive skills and experience) and one as your **default resume** (current go-to for applications)
- Both can be the same file

### AI Job Analysis *(next)*

Powered by **Claude Sonnet 4.6** via the Anthropic API.

**From the extension popup (no save required)**
- Open the Analyze tab on any job page
- Select which resume to score and which master resume to cross-reference
- Get an instant analysis:
  - **Current score** — how well your resume matches this job today (0–100)
  - **Strengths** — what your resume already covers well
  - **Gaps** — requirements you don't address
  - **Improvement suggestions** — specific additions from your master resume that are relevant to this job, each with an estimated score impact
  - **Projected score** — your score if you incorporated the suggestions
- Decide to save the job or move on — analysis runs before you commit to anything

**From the dashboard**
- Analyze any saved job directly from the detail panel
- Re-analyze after updating your resume to track score improvement over time
- Full run history: see how your score evolved across resume versions

**AI Analysis page**
- Lists every analysis run, grouped by job, scoped to the active profile
- Score history shown as a progression (67 → 74 → 82)
- Filter by score range and resume version
- Jobs analyzed from the popup but not yet saved show an inline "Save to profile" button

### AI Resume Tailoring *(planned)*

- Generate a fully tailored version of your default resume for a specific job
- Side-by-side diff view — additions highlighted green, removals struck through
- Accept or reject individual suggestions
- Save the accepted version as a new file in both `.docx` and `.pdf` format, alongside your original

---

## Configuration

### API keys

If you plan to use the AI analysis features, create a `.env` file in `job-tracker/backend/`:

```bash
cp job-tracker/backend/.env.example job-tracker/backend/.env
# then edit .env and add your Anthropic API key
```

```
ANTHROPIC_API_KEY=sk-ant-...
```

The backend loads this automatically on startup. Get a key at [console.anthropic.com](https://console.anthropic.com).

### Ports

The backend runs on `8000` and the dashboard on `5173`. Both are hardcoded for local use only — the backend binds to `127.0.0.1`, not `0.0.0.0`.

---

## Data & privacy

Everything stays on your machine. The SQLite database is at `job-tracker/backend/jobs.db` and is excluded from version control. No telemetry, no accounts, no external services (except the Anthropic API if you opt into AI features).

---

## License

MIT
