'use strict';

let profiles = [];
let activeProfileId = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Restore saved profile choice
  const stored = await chrome.storage.local.get('activeProfileId');
  activeProfileId = stored.activeProfileId ?? null;

  // Set today as default applied date
  document.getElementById('applied_date').value = today();

  // Wire up listeners
  document.getElementById('save-btn').addEventListener('click', saveJob);
  document.getElementById('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173' });
  });
  document.getElementById('profile-select').addEventListener('change', onProfileChange);

  // Fetch profiles, then scrape
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

  if (profiles.length === 0) {
    select.innerHTML = '<option value="">No profiles</option>';
    document.getElementById('save-btn').disabled = true;
    return;
  }

  // If saved ID is no longer valid, default to first profile
  if (!profiles.find((p) => p.id === activeProfileId)) {
    activeProfileId = profiles[0].id;
    chrome.storage.local.set({ activeProfileId });
  }

  select.innerHTML = profiles
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === activeProfileId ? 'selected' : ''}>${esc(p.name)}</option>`
    )
    .join('');

  updateSaveButton();
}

function onProfileChange(e) {
  activeProfileId = parseInt(e.target.value, 10);
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const result = await chrome.tabs
      .sendMessage(tab.id, { type: 'SCRAPE_JOB' })
      .catch(() => null);

    if (result?.success && result.data) {
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
    await sendToBackground({ type: 'SAVE_JOB', data: payload });

    const profile = profiles.find((p) => p.id === activeProfileId);
    btn.textContent = 'Saved! ✓';
    btn.classList.add('btn--success');
    setHint('success', `Saved to ${profile?.name ?? 'profile'}`);

    setTimeout(() => {
      btn.disabled = false;
      btn.classList.remove('btn--success');
      updateSaveButton();
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

function today() {
  return new Date().toISOString().split('T')[0];
}

function sourceLabel(src) {
  return { linkedin: 'LinkedIn', naukri: 'Naukri', indeed: 'Indeed', greenhouse: 'Greenhouse' }[src] ?? src;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
