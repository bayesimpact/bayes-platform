import { randomUUID } from "node:crypto"
import type { TestingModule } from "@nestjs/testing"
import { DataSource } from "typeorm"
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
  const grantId = await createAppGrant(module, {
    installationId: installed.installationId,
    appManifestId: manifest.id,
    projectId: params.projectId,
    permissions: params.permissions,
  })
  return {
    installationId: installed.installationId,
    serviceUserId: installed.serviceUserId,
    accessToken: signAppAccessToken({
      serviceUserId: installed.serviceUserId,
      installationId: installed.installationId,
      grantId,
    }),
  }
}

/** The app's OAuth client and the live grant of the installation, as consent leaves them. */
async function createAppGrant(
  module: TestingModule,
  params: {
    installationId: string
    appManifestId: string
    projectId: string
    permissions: readonly string[]
  },
): Promise<string> {
  const dataSource = module.get(DataSource)
  const [client]: { id: string }[] = await dataSource.query(
    `INSERT INTO "oauth_client" ("client_id", "registration_type", "redirect_uris", "app_manifest_id")
     VALUES ($1, 'app', '[]', $2)
     ON CONFLICT ("client_id") DO UPDATE SET "app_manifest_id" = EXCLUDED."app_manifest_id"
     RETURNING "id"`,
    [`app_test_${params.appManifestId.replaceAll("-", "")}`, params.appManifestId],
  )
  const [grant]: { id: string }[] = await dataSource.query(
    `INSERT INTO "oauth_grant" ("user_id", "oauth_client_id", "permissions", "resource", "app_installation_id")
     VALUES (NULL, $1, $2, $3, $4)
     RETURNING "id"`,
    [
      client?.id,
      JSON.stringify(params.permissions),
      `${APPS_TEST_ORIGIN}/api/apps/v1`,
      params.installationId,
    ],
  )
  if (!grant) throw new Error("No grant created")
  await dataSource.query(
    `INSERT INTO "oauth_grant_project" ("oauth_grant_id", "project_id") VALUES ($1, $2)`,
    [grant.id, params.projectId],
  )
  return grant.id
}

export function signAppAccessToken(params: {
  serviceUserId: string
  installationId: string
  grantId: string
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
      grant_id: params.grantId,
      installation_id: params.installationId,
      scope: "",
      iat: issuedAt,
      exp: issuedAt + 3600,
      jti: randomUUID(),
    },
    privateKey,
  )
}
