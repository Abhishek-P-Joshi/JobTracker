function scrapeNaukri() {
  const get = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;

  return {
    title:
      get('.jd-header-title') ||
      get('h1.title') ||
      get('[class*="jd-header-title"]'),
    company:
      get('.jd-header-comp-name a') ||
      get('.jd-header-comp-name') ||
      get('.comp-name'),
    location:
      get('.loc') ||
      get('.location') ||
      get('[class*="loc"]'),
    workTypeHint:
      get('.other-details') ||
      get('[class*="other-details"]') ||
      get('[class*="workMode"]'),
    description:
      htmlToMarkdown(document.querySelector('.job-desc')) ||
      htmlToMarkdown(document.querySelector('[class*="job-desc"]')) ||
      htmlToMarkdown(document.querySelector('[class*="jobDesc"]')),
    // Raw salary text: scraper.js will parse "8-12 Lacs PA" → INR min/max
    salaryRaw:
      get('.salary') ||
      get('[class*="salary"]') ||
      get('[class*="Salary"]'),
    url: window.location.href,
    source: 'naukri',
    currency: 'INR',
  };
}
