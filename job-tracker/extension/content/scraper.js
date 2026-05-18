// detectWorkType is used by runScraper after site files define the raw scrapers.
function detectWorkType(hint, description) {
  const text = ((hint || '') + ' ' + (description || '')).toLowerCase();
  if (/work from home|remote/.test(text)) return 'remote';
  if (/hybrid/.test(text)) return 'hybrid';
  if (/on-site|onsite|in-office|in office|work from office/.test(text)) return 'onsite';
  return 'unknown';
}

// Each sites/*.js file is loaded before this one and defines a global function.
const SITE_SCRAPERS = {};
/* eslint-disable no-undef */
if (typeof scrapeLinkedIn === 'function') SITE_SCRAPERS['linkedin.com'] = scrapeLinkedIn;
if (typeof scrapeNaukri === 'function')   SITE_SCRAPERS['naukri.com']   = scrapeNaukri;
if (typeof scrapeIndeed === 'function')   SITE_SCRAPERS['indeed.com']   = scrapeIndeed;
if (typeof scrapeGreenhouse === 'function') SITE_SCRAPERS['greenhouse.io'] = scrapeGreenhouse;
/* eslint-enable no-undef */

function runScraper() {
  const hostname = window.location.hostname;
  for (const [domain, fn] of Object.entries(SITE_SCRAPERS)) {
    if (hostname.includes(domain)) {
      try {
        const raw = fn();
        const { workTypeHint, description, ...rest } = raw;
        return {
          ...rest,
          job_description: description,
          work_type: detectWorkType(workTypeHint, description),
        };
      } catch (_e) {
        return null;
      }
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_JOB') {
    const data = runScraper();
    sendResponse(data ? { success: true, data } : { success: false });
  }
});
