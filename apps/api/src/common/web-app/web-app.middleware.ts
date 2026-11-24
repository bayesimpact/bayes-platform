import { readFileSync } from "node:fs"
import { relative } from "node:path"
import { Logger } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import type { NextFunction, Request, Response } from "express"
import { isReservedPath } from "@/config/api-prefix"
import {
  buildWebAppRuntimeConfig,
  getDeskAppSettings,
  getEvalAppSettings,
  getWebAppSettings,
  type WebAppSettings,
} from "./web-app-config"
import { renderIndexHtml } from "./web-app-html"

const logger = new Logger("WebApp")

/**
 * Serves the built web front at `/` from the API process when WEB_APP_DIST_DIR
 * is set, the Desk at `/app` when DESK_APP_DIST_DIR is and the Evaluation app
 * at `/eval` when EVAL_APP_DIST_DIR is (the `app-runtime` image). Registers
 * nothing otherwise, so the `api-runtime` image and local development are
 * unchanged.
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
  evalSettings: WebAppSettings | null = getEvalAppSettings(),
): void {
  // The Desk and the Evaluation app first: their paths under /app and /eval would otherwise
  // reach the web front's fallback.
  if (deskSettings) registerAppAtPath(app, deskSettings, DESK_APP)
  if (evalSettings) registerAppAtPath(app, evalSettings, EVAL_APP)
  if (!settings) return
  logger.log(`Serving the web front from ${settings.distDir} at /`)
  app.useStaticAssets(settings.distDir, staticOptions(settings))
  app.use(buildSpaFallback(settings))
}

/** An app served under a path of its own, ahead of the web front. */
type AppAtPath = {
  /** How the logs name it. */
  name: string
  /** Where it is served, as its Vite base without the last slash. */
  path: string
}

const DESK_APP: AppAtPath = { name: "the Desk", path: "/app" }
const EVAL_APP: AppAtPath = { name: "the Evaluation app", path: "/eval" }

/**
 * Serves an app at its path, the Desk at `/app` or the Evaluation app at `/eval`:
 * its static files, then its entry page with the runtime configuration for every
 * navigation under that path. `/app` redirects to `/app/`, the app's base. A file
 * missing under `/app/assets/`, such as a chunk of a previous release, is a 404:
 * the app then offers to reload, where the entry page would break the import
 * with HTML.
 */
function registerAppAtPath(
  app: NestExpressApplication,
  settings: WebAppSettings,
  { name, path: appPath }: AppAtPath,
): void {
  logger.log(`Serving ${name} from ${settings.distDir} at ${appPath}/`)
  app.useStaticAssets(settings.distDir, { ...staticOptions(settings), prefix: appPath })
  const html = renderIndexHtml(
    readFileSync(settings.indexHtmlPath, "utf8"),
    buildWebAppRuntimeConfig(),
  )

  app.use((request: Request, response: Response, next: NextFunction): void => {
    const { path } = request
    if (path !== appPath && !path.startsWith(`${appPath}/`)) {
      next()
      return
    }
    const isNavigation = request.method === "GET" || request.method === "HEAD"
    if (path === appPath && isNavigation) {
      const { search } = new URL(request.originalUrl, "http://app.invalid")
      response.redirect(301, `${appPath}/${search}`)
      return
    }
    if (!isNavigation || path.startsWith(`${appPath}/assets/`) || !request.accepts("html")) {
      response.status(404).end()
      return
    }
    response.status(200).set(ENTRY_PAGE_HEADERS).send(html)
  })
}

/**
 * The headers of an entry page: never cached, so a release reaches the next load,
 * and framed by pages of its own origin only, so another site cannot lay it under
 * a hidden click. The files of a build carry no such header: the sandbox page of
 * MCP App cards is one of them, and runs in a frame.
 */
const ENTRY_PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Permissions-Policy": "microphone=(self)",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "frame-ancestors 'self'",
}

/**
 * The static files of a build: hashed assets are immutable, the rest (theme
 * files, manifest) is short-lived so a tenant can swap them. `version.json`,
 * the build an open Desk or Evaluation app polls to learn of a new release, is
 * never kept by a cache on the way: each read revalidates it, with its ETag. The
 * entry page is never served from here (`index: false`).
 */
/** The file in which a build of the Desk or of the Evaluation app publishes its id (their vite.config.ts). */
const BUILD_MANIFEST_PATH = "version.json"

function staticOptions(settings: WebAppSettings) {
  // `path.relative` uses the platform separator: set HASHED_ASSETS_PREFIX to `assets\` on Windows.
  const hashedAssetsPrefix = process.env.HASHED_ASSETS_PREFIX ?? "assets/"
  return {
    index: false,
    redirect: false,
    setHeaders: (response: Response, filePath: string) => {
      const servedPath = relative(settings.distDir, filePath)
      const cacheControl = servedPath.startsWith(hashedAssetsPrefix)
        ? "public, max-age=31536000, immutable"
        : servedPath === BUILD_MANIFEST_PATH
          ? "no-cache"
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
        // The OAuth consent page must never sit in a frame at all, where a hidden
        // click would approve a client (ADR 0028).
        ...(request.path.startsWith("/oauth/") && {
          "X-Frame-Options": "DENY",
          "Content-Security-Policy": "frame-ancestors 'none'",
        }),
      })
      .send(html)
  }
}
