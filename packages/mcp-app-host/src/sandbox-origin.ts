/** Where a sandbox origin's template takes the label of an app's MCP server. */
const LABEL_PLACEHOLDER = "{label}"

/** How many hexadecimal characters of the hash a label keeps: a DNS label holds 63 at most. */
const LABEL_LENGTH = 32

/**
 * Where the sandbox of an app is served.
 *
 * `template` is what the install configures, if it does: an origin, such as
 * `https://{label}.staging.bayes-usercontent.org`. `{label}` stands for a label derived from
 * `key`, so the apps of one MCP server share an origin that no other server has. A template
 * without `{label}` is one origin for every app.
 *
 * `key` names who the app belongs to: the id of its MCP server.
 */
export type McpAppSandboxSource = {
  template?: string
  key?: string
}

/**
 * The DNS label of a key: the start of its SHA-256, in hexadecimal.
 *
 * It throws on a page served over plain http, or framed by one: the browser gives such a page no
 * `crypto.subtle`, so the app has no origin of its own to run in and must not run.
 */
export async function sandboxLabelOf(key: string): Promise<string> {
  if (!crypto.subtle) {
    throw new Error("The sandbox origin needs https: this page, or one that frames it, is http")
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
  return hex.join("").slice(0, LABEL_LENGTH)
}

/**
 * The origin that serves an app's sandbox, or `undefined` when the install configures none, or
 * when the template needs a key the app does not have: the host then writes the sandbox page
 * itself, in a frame with an opaque origin.
 *
 * It throws when the template does not give an origin, and when that origin is the host's own:
 * a sandbox that shares its host's origin isolates nothing, so the app must not run.
 */
export async function resolveSandboxOrigin(
  source: McpAppSandboxSource | undefined,
  hostOrigin: string,
): Promise<string | undefined> {
  const template = source?.template?.trim()
  if (!template) return undefined

  let candidate = template
  if (template.includes(LABEL_PLACEHOLDER)) {
    if (!source?.key) return undefined
    candidate = template.replaceAll(LABEL_PLACEHOLDER, await sandboxLabelOf(source.key))
  }

  let origin: string
  try {
    origin = new URL(candidate).origin
  } catch {
    throw new Error(`The sandbox origin is not a URL: ${candidate}`)
  }
  if (origin !== candidate || !/^https?:\/\//.test(origin)) {
    throw new Error(`The sandbox origin must be an http(s) origin, with no path: ${candidate}`)
  }
  if (origin === hostOrigin) {
    throw new Error("The sandbox origin must not be its host's own origin")
  }
  return origin
}
