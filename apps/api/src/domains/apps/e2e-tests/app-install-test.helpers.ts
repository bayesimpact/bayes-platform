import { randomUUID } from "node:crypto"
import type { TestingModule } from "@nestjs/testing"
import { signOAuthAccessToken } from "@/domains/oauth/oauth-crypto"
import { AppManifestRepository } from "../app-manifest.repository"
import { AppsService } from "../apps.service"

/**
 * The public origin the apps API checks its tokens against. supertest calls
 * the app on a new port each time, so the request's own origin would change.
 */
const APPS_TEST_ORIGIN = "http://apps-api.test"

/** Call once per spec file, before any request: the apps API reads it on each call. */
export function useAppsTestOrigin(): void {
  process.env.API_PUBLIC_URL = APPS_TEST_ORIGIN
}

/**
 * Installs an app on a project and issues the access token the authorization
 * server would give it after consent (ADR 0029), without the browser flow
 * the OAuth specs already cover.
 */
export async function installAppForTests(
  module: TestingModule,
  params: {
    userId: string
    projectId: string
    permissions: readonly string[]
    /** An existing app; without it, an app offering exactly `permissions` is created. */
    slug?: string
  },
): Promise<{ installationId: string; serviceUserId: string; accessToken: string }> {
  const appsService = module.get(AppsService)
  const manifest = params.slug
    ? await module.get(AppManifestRepository).findBySlug(params.slug)
    : await appsService.createAppManifest({
        name: "Helpful Assistant",
        slug: `helpful-assistant-${randomUUID().slice(0, 8)}`,
        description: null,
        logoUrl: null,
        grantablePermissions: [...params.permissions],
      })
  if (!manifest) throw new Error(`No app ${params.slug}`)
  const installed = await appsService.installApprovedApp({
    appManifestId: manifest.id,
    projectId: params.projectId,
    permissions: params.permissions,
    userId: params.userId,
  })
  return {
    installationId: installed.installationId,
    serviceUserId: installed.serviceUserId,
    accessToken: signAppAccessToken({
      serviceUserId: installed.serviceUserId,
      installationId: installed.installationId,
    }),
  }
}

export function signAppAccessToken(params: {
  serviceUserId: string
  installationId: string
}): string {
  const privateKey = process.env.OAUTH_SIGNING_PRIVATE_KEY
  if (!privateKey)
    throw new Error("OAUTH_SIGNING_PRIVATE_KEY is required to sign app tokens in tests")
  const issuedAt = Math.floor(Date.now() / 1000)
  return signOAuthAccessToken(
    {
      iss: `${APPS_TEST_ORIGIN}/api/oauth`,
      aud: `${APPS_TEST_ORIGIN}/api/apps/v1`,
      sub: params.serviceUserId,
      client_id: "app_test",
      grant_id: randomUUID(),
      installation_id: params.installationId,
      scope: "",
      iat: issuedAt,
      exp: issuedAt + 3600,
      jti: randomUUID(),
    },
    privateKey,
  )
}
