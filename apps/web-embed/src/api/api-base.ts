/** Base URL of the platform API the widget talks to, without a trailing slash. */
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000"

/**
 * The origin that serves the sandbox of MCP App cards, such as
 * `https://{label}.staging.bayes-usercontent.org`: `{label}` stands for a label of the card's MCP
 * server. Unset or empty, a card runs in a frame with an opaque origin that the widget writes.
 */
export const MCP_APP_SANDBOX_ORIGIN = import.meta.env.VITE_MCP_APP_SANDBOX_ORIGIN as
  | string
  | undefined

/** Absolute URL of a path on the API origin (`/public/v1/...`). */
export const apiUrl = (path: string) => `${API_BASE}${path}`

/** Absolute URL of a path relative to the private API (`/organizations/.../file`), served under `/api`. */
export const privateApiUrl = (path: string) => `${API_BASE}/api${path}`
