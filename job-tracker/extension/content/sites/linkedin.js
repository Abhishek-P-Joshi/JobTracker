function scrapeLinkedIn() {
  const get = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;

  return {
    title:
      get('.job-details-jobs-unified-top-card__job-title h1') ||
      get('.job-details-jobs-unified-top-card__job-title'),
    company:
      get('.job-details-jobs-unified-top-card__company-name a') ||
      get('.job-details-jobs-unified-top-card__company-name'),
    location: get('.job-details-jobs-unified-top-card__bullet'),
    workTypeHint: get('.job-details-jobs-unified-top-card__workplace-type'),
    description:
      get('.jobs-description__content .jobs-description-content__text') ||
      get('.jobs-description__content'),
    url: window.location.href,
    source: 'linkedin',
    salary_min: null,
    salary_max: null,
    currency: 'INR',
  };
}
