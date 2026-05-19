'use strict';

const DASHBOARD_URL = 'http://localhost:5173';

let profiles = [];
let activeProfileId = null;
let scrapedData = null;   // last successful scrape result
let resumeFiles = [];
let analyzeTabReady = false;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const stored = await chrome.storage.local.get('activeProfileId');
  activeProfileId = stored.activeProfileId ?? null;

  // Use local date to avoid UTC-offset day-off bug (important for UTC+ timezones)
  document.getElementById('applied_date').value = localDateString();

  document.getElementById('save-btn').addEventListener('click', saveJob);
  document.getElementById('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: DASHBOARD_URL }).catch(() => {});
  });
  document.getElementById('profile-select').addEventListener('change', onProfileChange);
  document.getElementById('run-analysis-btn').addEventListener('click', runAnalysis);
  document.getElementById('re-analyze-btn').addEventListener('click', () => showAnalyzeState('setup'));
  document.getElementById('analyze-retry-btn').addEventListener('click', () => showAnalyzeState('setup'));

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.remove('tab-btn--active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('tab-btn--active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById('tab-save').classList.toggle('hidden', tab !== 'save');
      document.getElementById('tab-analyze').classList.toggle('hidden', tab !== 'analyze');
      if (tab === 'analyze' && !analyzeTabReady) initAnalyzeTab();
    });
  });

  await loadProfiles();
  await scrapeCurrentTab();
}

// ── Profiles ────────────────────────────────────────────────

async function loadProfiles() {
  try {
    profiles = await sendToBackground({ type: 'GET_PROFILES' });
    renderProfileSelector();
  } catch (_e) {
    setHint('error', 'Backend not running. Start it with: python run.py');
    document.getElementById('save-btn').disabled = true;
  }
}

function renderProfileSelector() {
  const select = document.getElementById('profile-select');

  // Clear existing options safely
  while (select.firstChild) select.removeChild(select.firstChild);

  if (profiles.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No profiles';
    select.appendChild(opt);
    document.getElementById('save-btn').disabled = true;
    return;
  }

  // If saved ID is no longer in the list, fall back to first profile
  if (!profiles.find((p) => p.id === activeProfileId)) {
    activeProfileId = profiles[0].id;
    chrome.storage.local.set({ activeProfileId });
  }

  for (const p of profiles) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name; // textContent is XSS-safe; no escaping needed
    opt.selected = p.id === activeProfileId;
    select.appendChild(opt);
  }

  updateSaveButton();
}

function onProfileChange(e) {
  const parsed = parseInt(e.target.value, 10);
  if (isNaN(parsed)) return; // guard against empty/invalid option
  activeProfileId = parsed;
  chrome.storage.local.set({ activeProfileId });
  updateSaveButton();
}

function updateSaveButton() {
  const profile = profiles.find((p) => p.id === activeProfileId);
  const btn = document.getElementById('save-btn');
  btn.textContent = profile ? `Save to ${profile.name}` : 'Save Job';
  btn.disabled = !profile;
}

// ── Scraper ──────────────────────────────────────────────────

async function scrapeCurrentTab() {
  try {
    // lastFocusedWindow avoids returning the popup window itself
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return;

    const result = await chrome.tabs
      .sendMessage(tab.id, { type: 'SCRAPE_JOB' })
      .catch(() => null);

    if (result?.success && result.data) {
      scrapedData = result.data;
      fillForm(result.data);
      setHint('success', `Auto-filled from ${sourceLabel(result.data.source)}`);
    } else {
      setHint('info', 'Navigate to a job listing to auto-fill');
    }
  } catch (_e) {
    setHint('info', 'Navigate to a job listing to auto-fill');
  }
}

function fillForm(data) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== null && val !== undefined && val !== '') el.value = val;
  };

  set('company', data.company);
  set('title', data.title);
  set('location', data.location);
  set('work_type', data.work_type);
  set('url', data.url);
  set('source', data.source);
  set('job_description', data.job_description);
  if (data.salary_min) set('salary_min', data.salary_min);
  if (data.salary_max) set('salary_max', data.salary_max);
  if (data.currency) set('currency', data.currency);
}

// ── Save ─────────────────────────────────────────────────────

async function saveJob() {
  const company = document.getElementById('company').value.trim();
  const title = document.getElementById('title').value.trim();

  if (!company || !title) {
    setHint('error', 'Company and Job Title are required.');
    return;
  }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const payload = {
    profile_id: activeProfileId,
    company,
    title,
    location: valOrNull('location'),
    work_type: document.getElementById('work_type').value || 'unknown',
    salary_min: intOrNull('salary_min'),
    salary_max: intOrNull('salary_max'),
    currency: document.getElementById('currency').value || 'INR',
    status: document.getElementById('status').value || 'wishlist',
    source: valOrNull('source'),
    url: valOrNull('url'),
    applied_date: valOrNull('applied_date'),
    notes: valOrNull('notes'),
    job_description: valOrNull('job_description'),
  };

  try {
    const result = await sendToBackground({ type: 'SAVE_JOB', data: payload });

    if (result?.duplicate) {
      btn.classList.remove('btn--success');
      const company = result.existing?.company ?? 'unknown company';
      const title   = result.existing?.title   ?? 'this job';
      setHint('warn', `Already saved: "${title}" at ${company}. Open the dashboard to view it.`);
      btn.disabled = false;
      updateSaveButton();
      return;
    }

    const profile = profiles.find((p) => p.id === activeProfileId);
    btn.textContent = 'Saved! ✓';
    btn.classList.add('btn--success');
    setHint('success', `Saved to ${profile?.name ?? 'profile'}`);

    setTimeout(() => {
      btn.classList.remove('btn--success');
      updateSaveButton(); // updateSaveButton controls btn.disabled — don't set it separately
    }, 2000);
  } catch (e) {
    setHint('error', e.message || 'Failed to save. Is the backend running?');
    btn.disabled = false;
    updateSaveButton();
  }
}

// ── Helpers ──────────────────────────────────────────────────

function sendToBackground(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

function setHint(type, text) {
  const el = document.getElementById('scrape-hint');
  el.className = `hint hint--${type}`;
  el.textContent = text;
}

function valOrNull(id) {
  const v = document.getElementById(id)?.value?.trim();
  return v || null;
}

function intOrNull(id) {
  const v = parseInt(document.getElementById(id)?.value, 10);
  return isNaN(v) ? null : v;
}

function localDateString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function sourceLabel(src) {
  return (
    { linkedin: 'LinkedIn', naukri: 'Naukri', indeed: 'Indeed', greenhouse: 'Greenhouse' }[src] ??
    src
  );
}

// ── Analyze tab ──────────────────────────────────────────────

async function initAnalyzeTab() {
  analyzeTabReady = true;
  try {
    await loadResumeFiles();
  } catch (_e) {
    analyzeTabReady = false; // allow retry on next tab open
  }
  updateAnalyzeReadiness();
}

async function loadResumeFiles() {
  const sel1 = document.getElementById('scored-resume-select');
  const sel2 = document.getElementById('master-resume-select');
  try {
    resumeFiles = await sendToBackground({ type: 'GET_RESUMES' });
    [sel1, sel2].forEach((s) => { while (s.firstChild) s.removeChild(s.firstChild); });

    if (resumeFiles.length === 0) {
      [sel1, sel2].forEach((s) => {
        const o = document.createElement('option');
        o.value = ''; o.textContent = 'No resumes found';
        s.appendChild(o);
      });
      return;
    }

    for (const f of resumeFiles) {
      const o1 = document.createElement('option');
      o1.value = f.filename; o1.textContent = f.filename;
      if (f.is_default) o1.selected = true;
      sel1.appendChild(o1);

      const o2 = document.createElement('option');
      o2.value = f.filename; o2.textContent = f.filename;
      if (f.is_master) o2.selected = true;
      sel2.appendChild(o2);
    }
  } catch (_e) {
    const notice = document.getElementById('analyze-notice');
    notice.textContent = 'Configure your resume folder in the dashboard Settings first.';
    notice.classList.remove('hidden');
    sel1.disabled = true;
    sel2.disabled = true;
  }
}

function updateAnalyzeReadiness() {
  const btn = document.getElementById('run-analysis-btn');
  const notice = document.getElementById('analyze-notice');
  const jd = document.getElementById('job_description')?.value?.trim();

  if (resumeFiles.length === 0) {
    // notice already set by loadResumeFiles on failure
    btn.disabled = true;
    return;
  }
  if (!jd) {
    notice.textContent = 'Navigate to a job listing page to run analysis.';
    notice.classList.remove('hidden');
    btn.disabled = true;
    return;
  }
  notice.classList.add('hidden');
  btn.disabled = false;
}

async function runAnalysis() {
  const jd = document.getElementById('job_description')?.value?.trim();
  const scoredFilename = document.getElementById('scored-resume-select').value;
  const masterFilename = document.getElementById('master-resume-select').value;
  if (!jd || !scoredFilename || !masterFilename || !activeProfileId) return;

  showAnalyzeState('loading');
  try {
    const result = await sendToBackground({
      type: 'ANALYZE_JOB',
      data: {
        profile_id: activeProfileId,
        job_description: jd,
        scored_resume_filename: scoredFilename,
        master_resume_filename: masterFilename,
        job_title: scrapedData?.title ?? null,
        company: scrapedData?.company ?? null,
        url: scrapedData?.url ?? null,
      },
    });
    renderAnalysisResult(result);
    showAnalyzeState('result');
  } catch (e) {
    document.getElementById('analyze-error-msg').textContent = e.message || 'Analysis failed.';
    showAnalyzeState('error');
  }
}

function showAnalyzeState(state) {
  ['setup', 'loading', 'result', 'error'].forEach((s) => {
    document.getElementById(`analyze-${s}`).classList.toggle('hidden', s !== state);
  });
}

function renderAnalysisResult(data) {
  document.getElementById('result-score').textContent = data.current_score;
  document.getElementById('result-projected').textContent =
    data.projected_score != null ? `→ ${data.projected_score} projected` : '';
  document.getElementById('result-verdict').textContent = data.verdict ?? '';
  renderList('result-strengths', 'Strengths', data.strengths ?? [], '✓');
  renderList('result-gaps', 'Gaps', data.gaps ?? [], '✗');
  renderSuggestions('result-suggestions', data.suggestions ?? []);
}

function renderList(containerId, heading, items, icon) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  if (!items.length) return;
  const h = document.createElement('p');
  h.className = 'result-section-heading';
  h.textContent = heading;
  el.appendChild(h);
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'result-item';
    const iconEl = document.createElement('span');
    iconEl.className = 'result-item-icon';
    iconEl.textContent = icon;
    const textEl = document.createElement('span');
    textEl.textContent = item;
    row.appendChild(iconEl);
    row.appendChild(textEl);
    el.appendChild(row);
  }
}

function renderSuggestions(containerId, suggestions) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  if (!suggestions.length) return;
  const h = document.createElement('p');
  h.className = 'result-section-heading';
  h.textContent = 'Suggestions';
  el.appendChild(h);
  for (const s of suggestions) {
    const row = document.createElement('div');
    row.className = 'result-item';
    const iconEl = document.createElement('span');
    iconEl.className = 'result-item-icon';
    iconEl.textContent = '+';
    const textEl = document.createElement('span');
    const impact = s.score_impact > 0 ? ` (+${s.score_impact} pts)` : '';
    textEl.textContent = s.text + impact;
    row.appendChild(iconEl);
    row.appendChild(textEl);
    el.appendChild(row);
  }
}
