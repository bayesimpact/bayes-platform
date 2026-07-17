/**
 * Brand marker-highlight for page titles (the gold felt-tip swipe from the Bayes
 * Impact DA — see `.hl` in `global.css`).
 *
 * Given a title and the keyword to emphasise, returns an HTML string with the
 * first occurrence of `keyword` wrapped in `<span class="hl">…</span>`. Render it
 * with `set:html`. The keyword is chosen editorially per page (the hero via the
 * `home.highlight` i18n key, each article via its `highlight` frontmatter field),
 * never auto-detected. Everything is HTML-escaped, so plain-text titles stay safe.
 *
 * If `keyword` is missing or not found in the title, the escaped title is returned
 * unchanged — a safe fallback that simply renders without a highlight.
 */
const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export function highlightKeyword(title: string, keyword?: string): string {
  if (!keyword) return escapeHtml(title)
  const index = title.indexOf(keyword)
  if (index === -1) return escapeHtml(title)

  const before = escapeHtml(title.slice(0, index))
  const match = escapeHtml(title.slice(index, index + keyword.length))
  const after = escapeHtml(title.slice(index + keyword.length))
  return `${before}<span class="hl">${match}</span>${after}`
}
