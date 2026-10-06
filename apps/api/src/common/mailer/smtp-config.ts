/** SMTP settings of the optional email delivery. Any standard SMTP server works. */
export type SmtpConfig = {
  host: string
  port: number
  /** TLS from the start (usually port 465). Otherwise the connection upgrades with STARTTLS. */
  secure: boolean
  auth?: { user: string; pass: string }
  /** Sender of the emails, e.g. `Platform <no-reply@example.org>`. */
  from: string
}

/**
 * Reads the SMTP settings. Returns null when `SMTP_HOST` is not set: the
 * platform then sends no email. Throws on a half-done configuration so a typo
 * stops the API at start instead of silently dropping emails.
 */
export function getSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim()
  if (!host) return null

  const from = env.SMTP_FROM?.trim()
  if (!from) throw new Error("SMTP_FROM is required when SMTP_HOST is set")

  const rawPort = env.SMTP_PORT?.trim() || "587"
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`SMTP_PORT must be a port number, got "${rawPort}"`)
  }

  const user = env.SMTP_USER?.trim()
  const pass = env.SMTP_PASSWORD ?? ""
  if (!user && pass) throw new Error("SMTP_USER is required when SMTP_PASSWORD is set")

  const rawSecure = env.SMTP_SECURE?.trim().toLowerCase()
  const secure = rawSecure ? rawSecure === "true" : port === 465

  return { host, port, secure, ...(user ? { auth: { user, pass } } : {}), from }
}
