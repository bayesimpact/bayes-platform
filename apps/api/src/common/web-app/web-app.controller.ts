import { readFileSync } from "node:fs"
import { Controller, Get, Header, Inject, Redirect } from "@nestjs/common"
import {
  buildWebAppRuntimeConfig,
  WEB_APP_PREFIX,
  WEB_APP_SETTINGS,
  type WebAppSettings,
} from "./web-app-config"
import { renderIndexHtml } from "./web-app-html"

/**
 * Serves the SPA entry page for `/app` and every route under it. The hashed
 * assets are served by express.static (see registerWebAppStaticAssets), so a
 * request that reaches this controller is a browser navigation: it gets the
 * entry page and the client router takes over.
 */
@Controller(WEB_APP_PREFIX.slice(1))
export class WebAppController {
  private readonly html: string

  constructor(@Inject(WEB_APP_SETTINGS) settings: WebAppSettings) {
    const template = readFileSync(settings.indexHtmlPath, "utf8")
    this.html = renderIndexHtml(template, buildWebAppRuntimeConfig())
  }

  @Get(["", "{*path}"])
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  @Header("Permissions-Policy", "microphone=(self)")
  @Header("X-Content-Type-Options", "nosniff")
  index(): string {
    return this.html
  }
}

/** `/` goes to the SPA: the API has no page of its own at the root. */
@Controller()
export class WebAppRootController {
  @Get()
  @Redirect(`${WEB_APP_PREFIX}/`, 302)
  root(): void {
    // The @Redirect decorator sends the response.
  }
}
