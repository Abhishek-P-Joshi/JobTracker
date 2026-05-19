'use strict';

/**
 * Converts a DOM element's content to plain text with lightweight Markdown-style
 * formatting. Block elements become newlines, list items become bullet points,
 * and headings get a blank line before them. The result is readable as plain text
 * and renders well inside a <pre> or whitespace-pre-wrap container.
 */
function htmlToMarkdown(el) {
  if (!el) return null;
  const clone = el.cloneNode(true);

  // Remove script/style/hidden nodes so their text never surfaces
  clone.querySelectorAll('script, style, [hidden]').forEach((n) => n.remove());
  clone.querySelectorAll('[style]').forEach((n) => {
    if (/display\s*:\s*none/i.test(n.style.cssText || n.getAttribute('style') || '')) n.remove();
  });

  // Headings — prepend blank line so they stand out
  for (let i = 1; i <= 6; i++) {
    clone.querySelectorAll(`h${i}`).forEach((n) => {
      n.prepend('\n');
      n.append('\n');
    });
  }

  // Block-level elements that should produce line breaks
  clone.querySelectorAll('p, div, section, article, header, footer').forEach((n) => {
    n.append('\n');
  });

  // Explicit line breaks
  clone.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));

  // List items — prefix with a bullet
  clone.querySelectorAll('li').forEach((n) => n.prepend('• '));

  return clone.textContent
    ?.replace(/\t/g, ' ')           // tabs → spaces
    .replace(/ {2,}/g, ' ')         // collapse multiple spaces
    .replace(/\n /g, '\n')          // strip leading spaces on new lines
    .replace(/\n{3,}/g, '\n\n')     // max two consecutive blank lines
    .trim() || null;
}
