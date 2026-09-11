import { existsSync } from "node:fs"
import { join } from "node:path"
import { PRIVATE_API_PATH } from "@/config/api-prefix"

/**
 * The web front (apps/web) served by the API, from the `app-runtime` image.
 *
 * Enabled when WEB_APP_DIST_DIR points to a built `apps/web/dist` folder. The
 * image sets it; the plain `api-runtime` image and local development do not,
 * so the API stays API-only there.
 *
 * The SPA lives at `/`. The private API lives under `/api` and the public API
 * under `/public`, so a browser reload on a SPA route never hits an API route
 * by accident, and an unknown API path gets a 404 rather than the SPA.
 */
export type WebAppSettings = {
  distDir: string
  indexHtmlPath: string
}

export function getWebAppSettings(env: NodeJS.ProcessEnv = process.env): WebAppSettings | null {
  const distDir = env.WEB_APP_DIST_DIR?.trim()
  if (!distDir) return null
  const indexHtmlPath = join(distDir, "index.html")
  if (!existsSync(indexHtmlPath)) return null
  return { distDir, indexHtmlPath }
}

/**
 * Runtime configuration handed to the browser as `window.__CONFIG__`.
 * Keys match `RuntimeConfig` in apps/web/src/config/runtime-config.ts.
 * Public by construction: never put a secret here.
 */
export type WebAppRuntimeConfig = Record<string, string>

const ENV_TO_CONFIG_KEY: Record<string, string> = {
  WEB_API_URL: "apiUrl",
  WEB_API_TIMEOUT_MS: "apiTimeoutMs",
  WEB_APP_TITLE: "appTitle",
  WEB_AGENT_EMBED_URL: "agentEmbedUrl",
  WEB_HELP_CENTER_URL: "helpCenterUrl",
  WEB_HELP_AGENT_EMBED_TOKEN: "helpAgentEmbedToken",
  WEB_HELP_AGENT_EMBED_COLOR: "helpAgentEmbedColor",
  WEB_HELP_AGENT_EMBED_HINT: "helpAgentEmbedHint",
  WEB_AUTH0_DOMAIN: "auth0Domain",
  WEB_AUTH0_CLIENT_ID: "auth0ClientId",
  WEB_AUTH0_AUDIENCE: "auth0Audience",
  WEB_AUTH0_ORGANIZATION_ID: "auth0OrganizationId",
  WEB_DEFAULT_CONVERSATION_AGENT_PROMPT: "defaultConversationAgentPrompt",
  WEB_DEFAULT_FORM_AGENT_PROMPT: "defaultFormAgentPrompt",
  WEB_DEFAULT_FORM_AGENT_SCHEMA: "defaultFormAgentSchema",
  WEB_DEFAULT_EXTRACTION_AGENT_PROMPT: "defaultExtractionAgentPrompt",
  WEB_DEFAULT_EXTRACTION_AGENT_SCHEMA: "defaultExtractionAgentSchema",
}

/**
 * Builds the browser configuration from the environment.
 *
 * Defaults keep the Helm values short: the API URL is `/api` on the page
 * origin (same image, same host; the SPA resolves it against its origin), and
 * the Auth0 tenant, audience and organization are those the API already
 * validates tokens against. The SPA client id has no API-side counterpart
 * (AUTH0_CLIENT_ID is a different application), so WEB_AUTH0_CLIENT_ID is
 * always required.
 */
export function buildWebAppRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): WebAppRuntimeConfig {
  const config: WebAppRuntimeConfig = {
    apiUrl: PRIVATE_API_PATH,
    auth0Domain: auth0DomainFromIssuerUrl(env.AUTH0_ISSUER_URL) ?? "",
    auth0Audience: env.AUTH0_AUDIENCE ?? "",
    auth0OrganizationId: env.AUTH0_ORGANIZATION_ID ?? "",
  }
  for (const [envName, configKey] of Object.entries(ENV_TO_CONFIG_KEY)) {
    const value = env[envName]
    if (value !== undefined) config[configKey] = value
  }
  return config
}

function auth0DomainFromIssuerUrl(issuerUrl: string | undefined): string | undefined {
  if (!issuerUrl) return undefined
  try {
    return new URL(issuerUrl).host
  } catch {
    return undefined
  }
}
