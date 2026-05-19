function scrapeIndeed() {
  const get = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;

  // Indeed renders salary in attribute snippet rows; find the one with a currency symbol
  const salaryRaw =
    get('[data-testid="salary-snippet"]') ||
    (() => {
      const snippets = document.querySelectorAll(
        '[data-testid="attribute_snippet_testid"]'
      );
      for (const el of snippets) {
        const text = el.textContent.trim();
        if (/\$|₹/.test(text)) return text;
      }
      return null;
    })();

  return {
    title:
      get('.jobsearch-JobInfoHeader-title span') ||
      get('.jobsearch-JobInfoHeader-title'),
    company:
      get('[data-testid="inlineHeader-companyName"] a') ||
      get('[data-testid="inlineHeader-companyName"]'),
    location: get('[data-testid="job-location"]'),
    workTypeHint: get('[data-testid="workplace-type"]'),
    description: htmlToMarkdown(document.querySelector('#jobDescriptionText')),
    salaryRaw,
    url: window.location.href,
    source: 'indeed',
    currency: 'USD',
  };
}
