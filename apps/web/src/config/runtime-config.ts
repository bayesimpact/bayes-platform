/**
 * Runtime configuration of the web app.
 *
 * Two sources, in priority order:
 * 1. `window.__CONFIG__`, injected into `index.html` by the API when it serves
 *    the SPA (the `app-runtime` image). One image serves every tenant, the
 *    values come from the API environment, like Grafana or Argo CD do.
 * 2. The `VITE_*` variables that Vite inlines at build time. Used by `vite dev`
 *    and by the static hosting builds (one build per tenant).
 *
 * Every read of the configuration goes through this module. Never read
 * `import.meta.env.VITE_*` elsewhere: the value would be frozen at build time.
 */
export type RuntimeConfig = {
  /**
   * Base URL of the private API, without a trailing slash. A path such as
   * `/api` (the default) is resolved against the page origin.
   */
  apiUrl: string
  apiTimeoutMs?: string
  appTitle?: string
  /** Base URL of the agent embed bundle (`launcher.js`, `index.html`). */
  agentEmbedUrl?: string
  helpCenterUrl?: string
  helpAgentEmbedToken?: string
  helpAgentEmbedColor?: string
  helpAgentEmbedHint?: string
  auth0Domain: string
  auth0ClientId: string
  auth0Audience: string
  auth0OrganizationId: string
  defaultConversationAgentPrompt?: string
  defaultFormAgentPrompt?: string
  defaultFormAgentSchema?: string
  defaultExtractionAgentPrompt?: string
  defaultExtractionAgentSchema?: string
}

declare global {
  interface Window {
    __CONFIG__?: Partial<RuntimeConfig>
  }
}

/** Where the API serves its private routes when nothing else is configured. */
export const DEFAULT_API_URL = "/api"

function readBuildTimeConfig(): RuntimeConfig {
  const env = import.meta.env
  return {
    apiUrl: env.VITE_API_URL ?? DEFAULT_API_URL,
    apiTimeoutMs: env.VITE_API_TIMEOUT_MS,
    appTitle: env.VITE_APP_TITLE,
    agentEmbedUrl: env.VITE_AGENT_EMBED_URL,
    helpCenterUrl: env.VITE_HELP_CENTER_URL,
    helpAgentEmbedToken: env.VITE_HELP_AGENT_EMBED_TOKEN,
    helpAgentEmbedColor: env.VITE_HELP_AGENT_EMBED_COLOR,
    helpAgentEmbedHint: env.VITE_HELP_AGENT_EMBED_HINT,
    auth0Domain: env.VITE_AUTH0_DOMAIN ?? "",
    auth0ClientId: env.VITE_AUTH0_CLIENT_ID ?? "",
    auth0Audience: env.VITE_AUTH0_AUDIENCE ?? "",
    auth0OrganizationId: env.VITE_AUTH0_ORGANIZATION_ID ?? "",
    defaultConversationAgentPrompt: env.VITE_DEFAULT_CONVERSATION_AGENT_PROMPT,
    defaultFormAgentPrompt: env.VITE_DEFAULT_FORM_AGENT_PROMPT,
    defaultFormAgentSchema: env.VITE_DEFAULT_FORM_AGENT_SCHEMA,
    defaultExtractionAgentPrompt: env.VITE_DEFAULT_EXTRACTION_AGENT_PROMPT,
    defaultExtractionAgentSchema: env.VITE_DEFAULT_EXTRACTION_AGENT_SCHEMA,
  }
}

/** Injected values win over build-time values, key by key. Undefined injected keys are ignored. */
export function mergeRuntimeConfig(
  buildTime: RuntimeConfig,
  injected: Partial<RuntimeConfig> | undefined,
): RuntimeConfig {
  const merged: RuntimeConfig = { ...buildTime }
  for (const [key, value] of Object.entries(injected ?? {})) {
    if (value !== undefined && value !== null) {
      ;(merged as Record<string, string | undefined>)[key] = String(value)
    }
  }
  return merged
}

/**
 * Makes the API base URL absolute and free of a trailing slash. `/api` (the
 * default, and what the API injects when it serves the SPA) becomes
 * `<origin>/api`; a full URL (static hosting talking to another host) is kept.
 */
export function resolveApiUrl(apiUrl: string, origin: string): string {
  const trimmed = apiUrl.trim().replace(/\/+$/, "")
  if (trimmed === "") return `${origin}${DEFAULT_API_URL}`
  if (trimmed.startsWith("/")) return `${origin}${trimmed}`
  return trimmed
}

function buildRuntimeConfig(): RuntimeConfig {
  const merged = mergeRuntimeConfig(
    readBuildTimeConfig(),
    typeof window === "undefined" ? undefined : window.__CONFIG__,
  )
  if (typeof window === "undefined") return merged
  return { ...merged, apiUrl: resolveApiUrl(merged.apiUrl, window.location.origin) }
}

export const runtimeConfig: RuntimeConfig = buildRuntimeConfig()

/**
 * Public path the SPA is served from, with a trailing slash: `/` both for the
 * static hosting builds and when the API serves it. Fixed at build time by Vite
 * (`base` in vite.config.ts, `VITE_BASE_PATH`) for the rare install that mounts
 * the front under a sub-path behind its own proxy.
 */
export const APP_BASE_PATH: string = import.meta.env.BASE_URL

/** Absolute URL of the SPA root, without trailing slash. Used for Auth0 redirects. */
export function getAppUrl(): string {
  return `${window.location.origin}${trimTrailingSlash(APP_BASE_PATH)}`
}

/**
 * Prefixes an app path (as built by the route helpers) with the SPA base path.
 * React Router applies the basename itself; this is for full-page navigations
 * (`window.location.assign`, `window.open`) that bypass it.
 */
export function toAppHref(path: string, basePath: string = APP_BASE_PATH): string {
  return `${trimTrailingSlash(basePath)}${path}`
}

/**
 * Current `window.location.pathname` with the SPA base path removed, so it can
 * be compared with route paths the way React Router's `location.pathname` is.
 */
export function getAppPathname(
  pathname: string = window.location.pathname,
  basePath: string = APP_BASE_PATH,
): string {
  const base = trimTrailingSlash(basePath)
  if (!base) return pathname
  if (pathname === base) return "/"
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname
}

function trimTrailingSlash(path: string): string {
  return path.replace(/\/$/, "")
}

/** URL of a file from `public/`, resolved against the SPA base path. */
export function publicAssetUrl(relativePath: string): string {
  return `${APP_BASE_PATH}${relativePath.replace(/^\//, "")}`
}
