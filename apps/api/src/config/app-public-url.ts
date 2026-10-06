/**
 * Public URL of the web app, used to build the links put in emails.
 * `APP_PUBLIC_URL` when set, otherwise the first `FRONTEND_URL` entry (the
 * CORS origins, which the app is served from). No trailing slash.
 */
export function getAppPublicUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.APP_PUBLIC_URL?.trim()
  const firstFrontendUrl = env.FRONTEND_URL?.split(",")[0]?.trim()
  const url = explicit || firstFrontendUrl
  return url ? url.replace(/\/+$/, "") : null
}
