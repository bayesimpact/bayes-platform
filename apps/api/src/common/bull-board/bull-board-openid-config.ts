import type { RequestHandler } from "express"
import type { ConfigParams } from "express-openid-connect"
import { requiresAuth } from "express-openid-connect"

/** Public URL of the API (scheme + host + optional port), no trailing slash. Used for OIDC redirects. */
export function normalizedBullBoardPublicBaseUrl(): string {
  const raw = process.env.BULL_BOARD_BASE_URL?.trim()
  if (!raw) {
    return ""
  }
  return raw.replace(/\/+$/u, "")
}

/** Path prefix where Bull Board UI is mounted (no leading/trailing slash). */
export function normalizedBullBoardRoute(): string {
  const raw = process.env.BULL_BOARD_ROUTE ?? "internal/bull-board"
  return raw.replace(/^\/+/u, "").replace(/\/+$/u, "")
}

export function bullBoardMountPath(): string {
  return `/${normalizedBullBoardRoute()}`
}

export function normalizedBullBoardAllowedEmailDomain(): string | undefined {
  const raw = process.env.BULL_BOARD_ALLOWED_EMAIL_DOMAIN?.trim()
  if (!raw) return undefined
  return raw.replace(/^@+/u, "").toLowerCase()
}

export function normalizedBullBoardAuth0Organization(): string {
  return (process.env.BULL_BOARD_AUTH0_ORGANIZATION ?? "").trim()
}

export function buildBullBoardAccessMiddleware(): RequestHandler {
  const requireAuthentication = requiresAuth()
  const allowedEmailDomain = normalizedBullBoardAllowedEmailDomain()
  if (!allowedEmailDomain) {
    throw new Error(
      "When BULL_BOARD_ENABLED=true, set BULL_BOARD_ALLOWED_EMAIL_DOMAIN to the email domain allowed to access the dashboard (e.g. example.com).",
    )
  }
  const allowedEmailSuffix = `@${allowedEmailDomain}`

  return (request, response, next) => {
    requireAuthentication(request, response, (authenticationError) => {
      if (authenticationError) {
        next(authenticationError)
        return
      }

      const emailClaim = request.oidc.user?.email
      const userEmail = typeof emailClaim === "string" ? emailClaim.toLowerCase() : ""
      const isEmailVerified = request.oidc.user?.email_verified === true
      if (!isEmailVerified || !userEmail.endsWith(allowedEmailSuffix)) {
        response.status(403).send("Forbidden")
        return
      }

      next()
    })
  }
}

/** Auth0 + express-openid-connect settings for the Bull Board dashboard (when `BULL_BOARD_ENABLED=true`). */
export function buildBullBoardOpenIdConnectConfig(): ConfigParams {
  const baseURL = normalizedBullBoardPublicBaseUrl()
  const clientID = process.env.BULL_BOARD_AUTH0_CLIENT_ID?.trim()
  const clientSecret = process.env.BULL_BOARD_AUTH0_CLIENT_SECRET?.trim()
  const secret = process.env.BULL_BOARD_OIDC_SECRET?.trim()
  const issuerBaseURL = (process.env.AUTH0_ISSUER_URL ?? "").trim().replace(/\/+$/u, "")
  const organization = normalizedBullBoardAuth0Organization()

  if (!baseURL) {
    throw new Error(
      "When BULL_BOARD_ENABLED=true, set BULL_BOARD_BASE_URL to the public origin of this API (e.g. https://connect.localhost:3000).",
    )
  }
  if (!issuerBaseURL) {
    throw new Error(
      "When BULL_BOARD_ENABLED=true, set AUTH0_ISSUER_URL (Auth0 tenant issuer, no trailing slash required).",
    )
  }
  if (!clientID || !clientSecret) {
    throw new Error(
      "When BULL_BOARD_ENABLED=true, set BULL_BOARD_AUTH0_CLIENT_ID and BULL_BOARD_AUTH0_CLIENT_SECRET (Regular Web Application in Auth0).",
    )
  }
  if (!secret || secret.length < 8) {
    throw new Error(
      "When BULL_BOARD_ENABLED=true, set BULL_BOARD_OIDC_SECRET to a random string at least 8 characters long (cookie encryption).",
    )
  }

  const boardPath = bullBoardMountPath()

  return {
    authRequired: false,
    idpLogout: true,
    auth0Logout: true,
    issuerBaseURL,
    baseURL,
    clientID,
    clientSecret,
    secret,
    authorizationParams: {
      response_type: "code",
      scope: "openid profile email",
      ...(organization ? { organization } : {}),
    },
    routes: {
      login: `${boardPath}/oauth/login`,
      logout: `${boardPath}/oauth/logout`,
      callback: `${boardPath}/oauth/callback`,
      postLogoutRedirect: baseURL,
    },
  }
}
