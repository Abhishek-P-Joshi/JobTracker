function scrapeNaukri() {
  const get = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;

  const salaryRaw =
    get('.salary') ||
    get('[class*="salary"]') ||
    get('[class*="Salary"]');

  const workTypeRaw =
    get('.other-details') ||
    get('[class*="other-details"]') ||
    get('[class*="workMode"]');

  let salary_min = null;
  let salary_max = null;

  if (salaryRaw) {
    // Handles "8-12 Lacs PA", "8-12 LPA", "8.5-12 Lakh"
    const m = salaryRaw.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:Lac|LPA|lakh|L)/i);
    if (m) {
      salary_min = Math.round(parseFloat(m[1]) * 100000);
      salary_max = Math.round(parseFloat(m[2]) * 100000);
    }
  }

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
    workTypeHint: workTypeRaw,
    description:
      get('.job-desc') ||
      get('[class*="job-desc"]') ||
      get('[class*="jobDesc"]'),
    url: window.location.href,
    source: 'naukri',
    salary_min,
    salary_max,
    currency: 'INR',
  };
}
