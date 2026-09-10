/** Base URL of the platform API the widget talks to, without a trailing slash. */
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000"

/** Absolute URL of an API path (`/public/v1/...`, `/uploads/...`). */
export const apiUrl = (path: string) => `${API_BASE}${path}`
