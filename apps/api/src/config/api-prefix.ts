import { PUBLIC_PATH_PREFIX } from "@caseai-connect/api-contracts"
import { type INestApplication, RequestMethod } from "@nestjs/common"

/**
 * Three surfaces share one origin (#770):
 * - `/`           the web front, when the process serves it (see common/web-app)
 * - `/api/...`    the private API, authenticated with OIDC access tokens
 * - `/public/...` the public chat API, a published contract that never moves
 *
 * Nest prefixes every controller route with `api`, except the public chat
 * controllers. Plain Express middleware (static files) is not prefixed and must
 * use {@link PRIVATE_API_PATH} itself.
 */
export const API_PREFIX = "api"

/** Leading-slash form of the private API prefix, for URLs built by hand. */
export const PRIVATE_API_PATH = `/${API_PREFIX}`

/** Leading-slash form of the public API prefix. */
export const PUBLIC_API_PATH = `/${PUBLIC_PATH_PREFIX}`

/**
 * RFC 8615 well-known documents: the OAuth metadata of the MCP endpoint and
 * of the authorization server (ADR 0028). Clients fetch them with a generic
 * `Accept: *\/*`, which the web front's catch-all would otherwise answer with
 * its HTML entry page.
 */
export const WELL_KNOWN_PATH = "/.well-known"

/** Paths the web front's catch-all must never answer. */
export const RESERVED_PATH_PREFIXES = [PRIVATE_API_PATH, PUBLIC_API_PATH, WELL_KNOWN_PATH]

export function isReservedPath(path: string): boolean {
  return RESERVED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function configureGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: PUBLIC_PATH_PREFIX, method: RequestMethod.ALL },
      { path: `${PUBLIC_PATH_PREFIX}/{*path}`, method: RequestMethod.ALL },
      // RFC 9728 metadata of the MCP endpoint, at the origin's well-known path.
      { path: ".well-known/{*path}", method: RequestMethod.GET },
    ],
  })
}
