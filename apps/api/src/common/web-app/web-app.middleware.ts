import { readFileSync } from "node:fs"
import { relative } from "node:path"
import { Logger } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import type { NextFunction, Request, Response } from "express"
import { isReservedPath } from "@/config/api-prefix"
import {
  buildWebAppRuntimeConfig,
  getDeskAppSettings,
  getWebAppSettings,
  type WebAppSettings,
} from "./web-app-config"
import { renderIndexHtml } from "./web-app-html"

const logger = new Logger("WebApp")

/**
 * Serves the built web front at `/` from the API process when WEB_APP_DIST_DIR
 * is set, and the Desk at `/app` when DESK_APP_DIST_DIR is (the `app-runtime`
 * image). Registers nothing otherwise, so the `api-runtime` image and local
 * development are unchanged.
 *
 * For each app, two Express middlewares, mounted before the Nest router:
 * - the static files of the build: hashed assets are immutable, the rest
 *   (theme files, manifest) is short-lived so a tenant can swap them. The entry
 *   page is never served from here (`index: false`);
 * - the SPA fallback: a browser navigation to any path outside `/api` and
 *   `/public` gets the entry page with the runtime configuration injected, and
 *   the client router takes over. Requests under the reserved prefixes fall
 *   through to Nest, so an unknown API path is a 404, never the SPA.
 */
export function registerWebApp(
  app: NestExpressApplication,
  settings: WebAppSettings | null = getWebAppSettings(),
  deskSettings: WebAppSettings | null = getDeskAppSettings(),
): void {
  // The Desk first: its paths under /app would otherwise reach the web front's fallback.
  if (deskSettings) registerDeskApp(app, deskSettings)
  if (!settings) return
  logger.log(`Serving the web front from ${settings.distDir} at /`)
  app.useStaticAssets(settings.distDir, staticOptions(settings))
  app.use(buildSpaFallback(settings))
}

/**
 * Serves the Desk at `/app`: its static files, then its entry page with the
 * runtime configuration for every navigation under `/app/`. `/app` redirects to
 * `/app/`, the Desk's base. A file missing under `/app/assets/`, such as a chunk
 * of a previous release, is a 404: the Desk then offers to reload, where the
 * entry page would break the import with HTML.
 */
function registerDeskApp(app: NestExpressApplication, settings: WebAppSettings): void {
  logger.log(`Serving the Desk from ${settings.distDir} at ${DESK_PATH}/`)
  app.useStaticAssets(settings.distDir, { ...staticOptions(settings), prefix: DESK_PATH })
  const html = renderIndexHtml(
    readFileSync(settings.indexHtmlPath, "utf8"),
    buildWebAppRuntimeConfig(),
  )

  app.use((request: Request, response: Response, next: NextFunction): void => {
    const { path } = request
    if (path !== DESK_PATH && !path.startsWith(`${DESK_PATH}/`)) {
      next()
      return
    }
    const isNavigation = request.method === "GET" || request.method === "HEAD"
    if (path === DESK_PATH && isNavigation) {
      const { search } = new URL(request.originalUrl, "http://desk.invalid")
      response.redirect(301, `${DESK_PATH}/${search}`)
      return
    }
    if (!isNavigation || path.startsWith(`${DESK_PATH}/assets/`) || !request.accepts("html")) {
      response.status(404).end()
      return
    }
    response.status(200).set(ENTRY_PAGE_HEADERS).send(html)
  })
}

/** Where the Desk is served, as its Vite base without the last slash. */
const DESK_PATH = "/app"

/** The headers of an entry page: never cached, so a release reaches the next load. */
const ENTRY_PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Permissions-Policy": "microphone=(self)",
  "X-Content-Type-Options": "nosniff",
}

/**
 * The static files of a build: hashed assets are immutable, the rest (theme
 * files, manifest) is short-lived so a tenant can swap them. The entry page is
 * never served from here (`index: false`).
 */
function staticOptions(settings: WebAppSettings) {
  // `path.relative` uses the platform separator: set HASHED_ASSETS_PREFIX to `assets\` on Windows.
  const hashedAssetsPrefix = process.env.HASHED_ASSETS_PREFIX ?? "assets/"
  return {
    index: false,
    redirect: false,
    setHeaders: (response: Response, filePath: string) => {
      const isHashedAsset = relative(settings.distDir, filePath).startsWith(hashedAssetsPrefix)
      const cacheControl = isHashedAsset
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300"
      response.setHeader("Cache-Control", cacheControl)
    },
  } as const
}

function buildSpaFallback(settings: WebAppSettings) {
  const template = readFileSync(settings.indexHtmlPath, "utf8")
  const html = renderIndexHtml(template, buildWebAppRuntimeConfig())

  return (request: Request, response: Response, next: NextFunction): void => {
    const isNavigation = request.method === "GET" || request.method === "HEAD"
    if (!isNavigation || isReservedPath(request.path) || !request.accepts("html")) {
      next()
      return
    }
    response
      .status(200)
      .set({
        ...ENTRY_PAGE_HEADERS,
        // The OAuth consent page must never sit in another site's frame, where a
        // hidden click would approve a client (ADR 0028).
        ...(request.path.startsWith("/oauth/") && {
          "X-Frame-Options": "DENY",
          "Content-Security-Policy": "frame-ancestors 'none'",
        }),
      })
      .send(html)
  }
}
