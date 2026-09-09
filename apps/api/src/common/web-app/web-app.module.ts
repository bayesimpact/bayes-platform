import { relative } from "node:path"
import { type DynamicModule, Logger, Module } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { WebAppController, WebAppRootController } from "./web-app.controller"
import {
  getWebAppSettings,
  WEB_APP_PREFIX,
  WEB_APP_SETTINGS,
  type WebAppSettings,
} from "./web-app-config"

const logger = new Logger("WebApp")

/**
 * Serves the built web front from the API process when WEB_APP_DIST_DIR is
 * set (the `app-runtime` image). Registers nothing otherwise, so the
 * `api-runtime` image and local development are unchanged.
 */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern (`register`)
export class WebAppModule {
  static register(settings: WebAppSettings | null = getWebAppSettings()): DynamicModule {
    if (!settings) return { module: WebAppModule }
    logger.log(`Serving the web front from ${settings.distDir} under ${WEB_APP_PREFIX}`)
    return {
      module: WebAppModule,
      controllers: [WebAppController, WebAppRootController],
      providers: [{ provide: WEB_APP_SETTINGS, useValue: settings }],
    }
  }
}

/**
 * Static files of the SPA under /app: hashed assets are immutable, the rest
 * (theme files, manifest) is short-lived so a tenant can swap them. The entry
 * page is never served from here (`index: false`): WebAppController renders
 * it with the runtime configuration.
 */
export function registerWebAppStaticAssets(
  app: NestExpressApplication,
  settings: WebAppSettings | null = getWebAppSettings(),
): void {
  if (!settings) return
  app.useStaticAssets(settings.distDir, {
    prefix: WEB_APP_PREFIX,
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
}
