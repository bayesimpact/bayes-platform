import { readFileSync } from "node:fs"
import { relative } from "node:path"
import { Logger } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import type { NextFunction, Request, Response } from "express"
import { isReservedPath } from "@/config/api-prefix"
import { buildWebAppRuntimeConfig, getWebAppSettings, type WebAppSettings } from "./web-app-config"
import { renderIndexHtml } from "./web-app-html"

const logger = new Logger("WebApp")

/**
 * Serves the built web front at `/` from the API process when WEB_APP_DIST_DIR
 * is set (the `app-runtime` image). Registers nothing otherwise, so the
 * `api-runtime` image and local development are unchanged.
 *
 * Two Express middlewares, mounted before the Nest router:
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
): void {
  if (!settings) return
  logger.log(`Serving the web front from ${settings.distDir} at /`)

  app.useStaticAssets(settings.distDir, {
    index: false,
    redirect: false,
    setHeaders: (response, filePath) => {
      const isHashedAsset = relative(settings.distDir, filePath).startsWith("assets/")
      const cacheControl = isHashedAsset
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300"
      response.setHeader("Cache-Control", cacheControl)
    },
  })

  app.use(buildSpaFallback(settings))
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
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Permissions-Policy": "microphone=(self)",
        "X-Content-Type-Options": "nosniff",
      })
      .send(html)
  }
}
