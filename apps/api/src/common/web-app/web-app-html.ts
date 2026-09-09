import type { WebAppRuntimeConfig } from "./web-app-config"

const CONFIG_SCRIPT_MARKER = "</head>"
const TITLE_PATTERN = /<title>[^<]*<\/title>/

/**
 * Serializes the configuration for inline use inside a <script> tag. JSON is
 * not HTML-safe on its own: `</script>` inside a value would end the tag.
 * Escaping `<`, `>` and `&` as unicode escapes keeps the payload valid JSON
 * and inert as HTML. U+2028 and U+2029 are line terminators in old JS engines.
 */
export function serializeForInlineScript(config: WebAppRuntimeConfig): string {
  return JSON.stringify(config)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

/**
 * Renders the SPA entry page: the built `index.html` with the runtime
 * configuration injected before `</head>`, so `window.__CONFIG__` exists
 * before the app bundle runs. The title is replaced when the tenant sets one
 * (the build leaves the default in place).
 */
export function renderIndexHtml(template: string, config: WebAppRuntimeConfig): string {
  const script = `<script>window.__CONFIG__=${serializeForInlineScript(config)}</script>`
  const withConfig = template.includes(CONFIG_SCRIPT_MARKER)
    ? template.replace(CONFIG_SCRIPT_MARKER, `${script}\n  ${CONFIG_SCRIPT_MARKER}`)
    : `${script}\n${template}`
  const appTitle = config.appTitle?.trim()
  if (!appTitle) return withConfig
  return withConfig.replace(TITLE_PATTERN, `<title>${escapeHtml(appTitle)}</title>`)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
