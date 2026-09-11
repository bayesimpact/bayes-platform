import { PUBLIC_PATH_PREFIX } from "@caseai-connect/api-contracts"
import { type INestApplication, RequestMethod } from "@nestjs/common"

/**
 * Three surfaces share one origin (#770):
 * - `/`           the web front, when the process serves it (see common/web-app)
 * - `/api/...`    the private API, authenticated with Auth0
 * - `/public/...` the public chat API, a published contract that never moves
 *
 * Nest prefixes every controller route with `api`, except the public chat
 * controllers. Middleware mounted through Nest (Bull Board) follows the same
 * rule; plain Express middleware (OIDC, static files) does not and must use
 * {@link PRIVATE_API_PATH} itself.
 */
export const API_PREFIX = "api"

/** Leading-slash form of the private API prefix, for URLs built by hand. */
export const PRIVATE_API_PATH = `/${API_PREFIX}`

/** Leading-slash form of the public API prefix. */
export const PUBLIC_API_PATH = `/${PUBLIC_PATH_PREFIX}`

/** Paths the web front's catch-all must never answer. */
export const RESERVED_PATH_PREFIXES = [PRIVATE_API_PATH, PUBLIC_API_PATH]

export function isReservedPath(path: string): boolean {
  return RESERVED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function configureGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: PUBLIC_PATH_PREFIX, method: RequestMethod.ALL },
      { path: `${PUBLIC_PATH_PREFIX}/{*path}`, method: RequestMethod.ALL },
    ],
  })
}
