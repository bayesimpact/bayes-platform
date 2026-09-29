import "dotenv/config"

/**
 * Link to the trace backend for one of our trace ids, built from
 * TRACE_URL_TEMPLATE (e.g. `https://traces.example.org/redirects/sessions/{traceId}`).
 * Undefined when no template is configured.
 */
export function getTraceUrl(traceId: string): string | undefined {
  const template = process.env.TRACE_URL_TEMPLATE
  if (!template) return undefined
  return template.replaceAll("{traceId}", encodeURIComponent(traceId))
}
