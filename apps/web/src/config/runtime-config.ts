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
  /** Base URL of the API. Empty string means same origin as the page. */
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

function readBuildTimeConfig(): RuntimeConfig {
  const env = import.meta.env
  return {
    apiUrl: env.VITE_API_URL ?? "",
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

export const runtimeConfig: RuntimeConfig = mergeRuntimeConfig(
  readBuildTimeConfig(),
  typeof window === "undefined" ? undefined : window.__CONFIG__,
)

/**
 * Public path the SPA is served from, with a trailing slash: `/` for the static
 * hosting builds, `/app/` when the API serves it. Fixed at build time by Vite
 * (`base` in vite.config.ts), this is a property of the image, not of the tenant.
 */
export const APP_BASE_PATH: string = import.meta.env.BASE_URL

/** Absolute URL of the SPA root, without trailing slash. Used for Auth0 redirects. */
export function getAppUrl(): string {
  return `${window.location.origin}${APP_BASE_PATH.replace(/\/$/, "")}`
}

/** URL of a file from `public/`, resolved against the SPA base path. */
export function publicAssetUrl(relativePath: string): string {
  return `${APP_BASE_PATH}${relativePath.replace(/^\//, "")}`
}
