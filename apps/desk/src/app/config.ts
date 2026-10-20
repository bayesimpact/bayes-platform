import { z } from "zod"

/** A value that may be absent or blank: both read as undefined. */
const optionalText = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined)

/** A JSON object of extra authorize parameters, such as `{"organization":"org_123"}` for Auth0. */
const authorizationParamsSchema = optionalText.transform((raw, context) => {
  if (!raw) return {}
  try {
    return z.record(z.string(), z.string()).parse(JSON.parse(raw))
  } catch {
    context.addIssue({ code: "custom", message: "must be a JSON object of strings" })
    return z.NEVER
  }
})

const apiModeConfigSchema = z.object({
  mode: z.literal("api"),
  oidcAuthority: z.url(),
  oidcClientId: z.string().min(1),
  oidcAudience: optionalText,
  oidcScope: optionalText,
  oidcAuthorizationParams: authorizationParamsSchema,
})

/** The mock mode serves every screen from the MSW handlers, with no API and no sign-in. */
const mockModeConfigSchema = z.object({ mode: z.literal("mock") })

const configSchema = z.discriminatedUnion("mode", [apiModeConfigSchema, mockModeConfigSchema])

export type AppConfig = z.output<typeof configSchema>
export type OidcConfig = z.output<typeof apiModeConfigSchema>

/**
 * The Desk's configuration, read once at startup: `window.__CONFIG__`, which the API injects into
 * index.html when it serves the Desk, then the `VITE_*` values of the build. This file is the only
 * one that reads `import.meta.env`, and nothing here is secret.
 */
/**
 * Whether this build runs the mock mode (`npm run dev:mock`). A constant of the build, so the mock
 * code that only it imports stays out of the production bundle.
 */
export const isMockMode = import.meta.env.MODE === "mock"

function readConfig(): AppConfig {
  const env = import.meta.env
  if (isMockMode) return { mode: "mock" }

  const buildTime = {
    oidcAuthority: env.VITE_OIDC_AUTHORITY,
    oidcClientId: env.VITE_OIDC_CLIENT_ID,
    oidcAudience: env.VITE_OIDC_AUDIENCE,
    oidcScope: env.VITE_OIDC_SCOPE,
    oidcAuthorizationParams: env.VITE_OIDC_AUTHORIZATION_PARAMS,
  }
  const injected = Object.fromEntries(
    Object.entries(window.__CONFIG__ ?? {}).filter(([, value]) => value !== undefined),
  )
  const result = configSchema.safeParse({ mode: "api", ...buildTime, ...injected })
  if (!result.success) {
    throw new Error(`The Desk's configuration is invalid:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

export const appConfig = readConfig()

/**
 * The path the Desk is served under, with its slashes, which the API serves it at: Vite's `base` in
 * vite.config.ts is the same. A constant rather than `import.meta.env.BASE_URL`, which Vitest sets
 * to `/`, so the tests run the Desk under its real path.
 */
export const appBasePath = "/app/"
