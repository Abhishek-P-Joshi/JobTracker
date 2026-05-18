function scrapeLinkedIn() {
  const get = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;

  // Salary may appear in the compensation insight row
  const salaryRaw =
    get('.job-details-jobs-unified-top-card__salary-link') ||
    get('.compensation__salary') ||
    (() => {
      // Fallback: scan insight rows for a "$" or currency symbol
      const rows = document.querySelectorAll(
        '.job-details-jobs-unified-top-card__job-insight'
      );
      for (const row of rows) {
        const text = row.textContent.trim();
        if (/\$|₹|salary|compensation/i.test(text)) return text;
      }
      return null;
    })();

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
    salaryRaw,
    url: window.location.href,
    source: 'linkedin',
    currency: 'USD',
  };
}
