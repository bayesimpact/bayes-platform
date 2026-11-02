/** Base URL of the platform API the widget talks to, without a trailing slash. */
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000"

/** Absolute URL of a path on the API origin (`/public/v1/...`). */
export const apiUrl = (path: string) => `${API_BASE}${path}`

/** Absolute URL of a path relative to the private API (`/organizations/.../file`), served under `/api`. */
export const privateApiUrl = (path: string) => `${API_BASE}/api${path}`
