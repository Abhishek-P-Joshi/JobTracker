function scrapeGreenhouse() {
  const get = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;

  // Company name is the first path segment: boards.greenhouse.io/COMPANY/jobs/...
  const pathMatch = window.location.pathname.match(/^\/([^/]+)/);
  const company = pathMatch
    ? pathMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return {
    title: get('h1.app-title') || get('h1'),
    company,
    location: get('.location') || get('[class*="location"]'),
    workTypeHint: null,
    description: get('#content') || get('.content'),
    url: window.location.href,
    source: 'greenhouse',
    salary_min: null,
    salary_max: null,
    currency: 'INR',
  };
}
