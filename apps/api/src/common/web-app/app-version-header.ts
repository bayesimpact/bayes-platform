import type { NestExpressApplication } from "@nestjs/platform-express"
import type { NextFunction, Request, Response } from "express"
import { PRIVATE_API_PATH } from "@/config/api-prefix"

/**
 * The header that names the release which answered a request of the private API. A tab of the
 * Desk that runs another release learns from it that a new one is deployed, and reloads when
 * nothing would be lost (apps/desk/src/lib/app-update.ts).
 */
export const APP_VERSION_HEADER = "X-App-Version"

/**
 * The release this process runs: the deployed image tag, else the commit it was built from, as
 * the Desk reads them from its injected configuration. Undefined in local development.
 */
export function readAppVersion(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.APP_VERSION?.trim() || env.GIT_SHA?.trim() || undefined
}

/**
 * Adds {@link APP_VERSION_HEADER} to every response under `/api`. The public API under `/public`
 * is a frozen contract and keeps its headers. Registers nothing when the process knows no version.
 */
export function registerAppVersionHeader(
  app: NestExpressApplication,
  version: string | undefined = readAppVersion(),
): void {
  if (!version) return
  app.use((request: Request, response: Response, next: NextFunction): void => {
    if (request.path.startsWith(`${PRIVATE_API_PATH}/`)) {
      response.setHeader(APP_VERSION_HEADER, version)
    }
    next()
  })
}
