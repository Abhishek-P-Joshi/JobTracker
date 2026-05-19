async function scrapeLinkedIn() {
  const jobId = window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];

  if (jobId) {
    try {
      const result = await fetchVoyagerJobData(jobId);
      if (result) return result;
    } catch (_e) {}
  }

  return scrapeLinkedInFallback();
}

// ── Voyager API ───────────────────────────────────────────────

async function fetchVoyagerJobData(jobId) {
  const csrfToken = linkedInCsrfToken();
  if (!csrfToken) return null;

  const jobResp = await fetch(
    `https://www.linkedin.com/voyager/api/jobs/jobPostings/${jobId}`,
    voyagerOpts(csrfToken, 'application/vnd.linkedin.normalized+json+2.1')
  );
  if (!jobResp.ok) return null;

  const json  = await jobResp.json();
  const data  = json.data ?? json;

  const title    = data.title ?? null;
  const location = data.formattedLocation ?? null;

  // companyDetails = { company: "urn:li:fs_normalized_company:{id}", $type: "..." }
  // The URN is not resolved in this response — requires a second fetch.
  let company = null;
  const companyUrn = data.companyDetails?.company;
  if (companyUrn) {
    company = await resolveCompanyName(companyUrn, csrfToken);
  }

  // workplaceTypesResolutionResults may be absent; detectWorkType() in scraper.js
  // will fall back to scanning the description text.
  let workTypeHint = '';
  const wtr = data.workplaceTypesResolutionResults;
  if (wtr && typeof wtr === 'object') {
    workTypeHint = Object.values(wtr).map((v) => v?.localizedName ?? '').join(' ');
  }

  if (!title && !company) return null;

  return {
    title,
    company,
    location,
    workTypeHint,
    description: data.description?.text ?? null,
    salaryRaw:   null,
    url:         window.location.href,
    source:      'linkedin',
    currency:    'USD',
  };
}

async function resolveCompanyName(urn, csrfToken) {
  // "urn:li:fs_normalized_company:3787845" → "3787845"
  const companyId = urn.split(':').pop();
  if (!companyId) return null;

  const resp = await fetch(
    `https://www.linkedin.com/voyager/api/organization/companies/${companyId}`,
    voyagerOpts(csrfToken, 'application/json')
  );
  if (!resp.ok) return null;

  const json = await resp.json();
  return (json.data ?? json).name ?? null;
}

function linkedInCsrfToken() {
  // JSESSIONID is LinkedIn's non-HttpOnly CSRF cookie.
  // Value format: "ajax:TOKEN" or "\"ajax:TOKEN\"" (Chrome may add quotes).
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith('JSESSIONID='))
    ?.split('=').slice(1).join('=')
    .replace(/^"|"$/g, '') ?? null;
}

function voyagerOpts(csrfToken, accept) {
  return {
    credentials: 'include',
    headers: {
      'accept':                      accept,
      'csrf-token':                  csrfToken,
      'x-restli-protocol-version':   '2.0.0',
      'x-li-lang':                   'en_US',
    },
  };
}

// ── DOM fallback (public / unauthenticated pages) ─────────────

// LinkedIn's public job pages set document.title to:
//   "Company hiring Title in Location | LinkedIn"
// Authenticated pages have a different title format — this is a last resort.
function scrapeLinkedInFallback() {
  let title = null, company = null, location = null;

  let m = document.title.match(
    /^(.+?)\s+hiring\s+(.+)\s+in\s+(.+?)\s*\|\s*LinkedIn\s*$/i
  );
  if (m) {
    company  = m[1].trim();
    title    = m[2].trim();
    location = m[3].trim();
  } else {
    m = document.title.match(/^(.+?)\s+hiring\s+(.+?)\s*\|\s*LinkedIn\s*$/i);
    if (m) {
      company = m[1].trim();
      title   = m[2].trim();
    }
  }

  const get = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;

  return {
    title,
    company,
    location,
    workTypeHint:
      get('.job-details-jobs-unified-top-card__workplace-type') ||
      get('.jobs-unified-top-card__workplace-type') ||
      null,
    description:
      get('.jobs-description__content .jobs-description-content__text') ||
      get('.jobs-description__content') ||
      null,
    salaryRaw: null,
    url:       window.location.href,
    source:    'linkedin',
    currency:  'USD',
  };
}
