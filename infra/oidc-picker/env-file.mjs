// Reads and edits dotenv files line by line, keeping comments and unrelated keys in place.
// Node built-ins only.

const ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/u

/** Values of a dotenv file. Like dotenv, the last assignment of a key wins. */
export function readEnvValues(text) {
  const values = {}
  for (const line of text.split("\n")) {
    const match = line.match(ASSIGNMENT)
    if (match) values[match[1]] = unquote(match[2].trim())
  }
  return values
}

/**
 * Sets keys in a dotenv file. Every assignment of a key is rewritten, since dotenv keeps the
 * last one. Missing keys are appended under `comment`, except those listed in `onlyExisting`,
 * which are only rewritten when the file already sets them.
 */
export function setEnvValues(text, values, { comment, onlyExisting = [] } = {}) {
  const lines = text === "" ? [] : text.replace(/\n$/u, "").split("\n")
  const written = new Set()
  const updated = lines.map((line) => {
    const key = line.match(ASSIGNMENT)?.[1]
    if (key === undefined || !(key in values)) return line
    written.add(key)
    return `${key}=${values[key]}`
  })
  const missing = Object.keys(values).filter(
    (key) => !written.has(key) && !onlyExisting.includes(key),
  )
  if (missing.length > 0) {
    if (updated.length > 0 && updated.at(-1) !== "") updated.push("")
    if (comment) updated.push(`# ${comment}`)
    for (const key of missing) updated.push(`${key}=${values[key]}`)
  }
  return updated.length > 0 ? `${updated.join("\n")}\n` : ""
}

function unquote(raw) {
  const quoted = raw.match(/^(["'`])(.*)\1$/u)
  if (quoted) return quoted[2]
  // An unquoted value ends at an inline comment, as with dotenv.
  return raw.replace(/\s+#.*$/u, "")
}
