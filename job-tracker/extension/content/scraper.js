// detectWorkType and parseSalary are called by runScraper after site files load.

function detectWorkType(hint, description) {
  const text = ((hint || '') + ' ' + (description || '')).toLowerCase();
  if (/work from home|remote/.test(text)) return 'remote';
  if (/hybrid/.test(text)) return 'hybrid';
  if (/on-site|onsite|in-office|in office|work from office/.test(text)) return 'onsite';
  return 'unknown';
}

/**
 * Parses a raw salary string into structured fields.
 * Supports:
 *   INR  — "8-12 Lacs PA", "8.5 - 12 LPA", "10 Lakh"
 *   CAD  — "CA$80,000 – CA$100,000", "CA$80K – $100K"
 *   USD  — "$80,000 – $120,000", "$80K – $120K"
 */
function parseSalary(text) {
  if (!text) return { salary_min: null, salary_max: null, currency: null };
  const t = text.trim();

  // INR Crore (must check before Lacs — "1-1.5 Cr PA" for senior roles)
  const crore = t.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:Cr|Crore)\b/i);
  if (crore) {
    return {
      salary_min: Math.round(parseFloat(crore[1]) * 10_000_000),
      salary_max: Math.round(parseFloat(crore[2]) * 10_000_000),
      currency: 'INR',
    };
  }

  // INR Lacs / LPA / Lakh
  const inr = t.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:Lac|LPA|Lakh|L)\b/i);
  if (inr) {
    return {
      salary_min: Math.round(parseFloat(inr[1]) * 100_000),
      salary_max: Math.round(parseFloat(inr[2]) * 100_000),
      currency: 'INR',
    };
  }

  // CAD: "CA$80,000 – CA$100,000" or "CA$80K – CA$100K"
  const cad = t.match(/CA?\$\s*([\d,]+(?:\.\d+)?)\s*(K)?\s*[-–—]\s*(?:CA?\$)?\s*([\d,]+(?:\.\d+)?)\s*(K)?/i);
  if (cad) {
    const [, s1, k1, s2, k2] = cad;
    return {
      salary_min: toAmount(s1, k1),
      salary_max: toAmount(s2, k2),
      currency: 'CAD',
    };
  }

  // USD: "$80,000 – $120,000" or "$80K – $120K"
  // Also catches CAD when prefixed with plain "$" but text contains "CAD"
  const usd = t.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(K)?\s*[-–—]\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(K)?/i);
  if (usd) {
    const [, s1, k1, s2, k2] = usd;
    const currency = /\bCAD\b|Canada/i.test(t) ? 'CAD' : 'USD';
    return {
      salary_min: toAmount(s1, k1),
      salary_max: toAmount(s2, k2),
      currency,
    };
  }

  return { salary_min: null, salary_max: null, currency: null };
}

function toAmount(numStr, kSuffix) {
  const n = parseFloat(numStr.replace(/,/g, ''));
  return kSuffix ? Math.round(n * 1000) : Math.round(n);
}

// Each sites/*.js file is loaded before this one and defines a global function.
const SITE_SCRAPERS = {};
/* eslint-disable no-undef */
if (typeof scrapeLinkedIn === 'function') SITE_SCRAPERS['linkedin.com'] = scrapeLinkedIn;
if (typeof scrapeNaukri === 'function')   SITE_SCRAPERS['naukri.com']   = scrapeNaukri;
if (typeof scrapeIndeed === 'function')   SITE_SCRAPERS['indeed.com']   = scrapeIndeed;
if (typeof scrapeGreenhouse === 'function') SITE_SCRAPERS['greenhouse.io'] = scrapeGreenhouse;
/* eslint-enable no-undef */

async function runScraper() {
  const hostname = window.location.hostname;
  for (const [domain, fn] of Object.entries(SITE_SCRAPERS)) {
    if (hostname.includes(domain)) {
      try {
        const raw = await fn();
        const { workTypeHint, description, salaryRaw, ...rest } = raw;
        const salary = parseSalary(salaryRaw);
        return {
          ...rest,
          job_description: description,
          work_type: detectWorkType(workTypeHint, description),
          salary_min: salary.salary_min,
          salary_max: salary.salary_max,
          // Use parsed currency only when detected; site file default is the fallback
          currency: salary.currency ?? rest.currency ?? 'INR',
        };
      } catch (e) {
        console.error('[JobTrack] scraper error:', e);
        return null;
      }
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_JOB') {
    runScraper()
      .then((data) => sendResponse(data ? { success: true, data } : { success: false }))
      .catch(() => sendResponse({ success: false }));
    return true; // keep message channel open for async response
  }
});
