function scrapeIndeed() {
  const get = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;

  return {
    title:
      get('.jobsearch-JobInfoHeader-title span') ||
      get('.jobsearch-JobInfoHeader-title'),
    company:
      get('[data-testid="inlineHeader-companyName"] a') ||
      get('[data-testid="inlineHeader-companyName"]'),
    location: get('[data-testid="job-location"]'),
    workTypeHint: get('[data-testid="workplace-type"]'),
    description: get('#jobDescriptionText'),
    url: window.location.href,
    source: 'indeed',
    salary_min: null,
    salary_max: null,
    currency: 'INR',
  };
}
