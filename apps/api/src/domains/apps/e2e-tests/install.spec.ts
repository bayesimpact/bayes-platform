import { randomUUID } from "node:crypto"
import {
  AppsRoutes,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { APP_INSTALLATION_STATUS_REVOKED } from "@/domains/apps/app-installation.entity"
import { withDocumentEmbeddingsBatchServiceMock } from "@/domains/documents/test-overrides"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { PermissionService } from "@/domains/rbac/permission.service"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { USER_TYPE_SERVICE } from "@/domains/users/user.types"
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AppsModule } from "../apps.module"

describe("Apps - Install", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule, RbacModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(
          withDocumentEmbeddingsBatchServiceMock(moduleBuilder),
          () => auth0Id,
        ),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createStaffInstaller = async () => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
    })
    await assignPlatformStaffToUser({ repositories, user })
    return { organization, project, user }
  }

  const createManifest = async (token = "token") => {
    const superadminAuth0Id = `auth0|${randomUUID()}`
    const previousAuth0Id = auth0Id
    auth0Id = superadminAuth0Id
    const { user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id: superadminAuth0Id, email: mockAuth0EmailForSub(superadminAuth0Id) },
    })
    await assignPlatformSuperadminToUser({ repositories, user })
    const created = await request({
      route: AppsRoutes.createOne,
      token,
      request: {
        payload: {
          name: "Helpful Assistant",
          slug: "helpful-assistant",
          description: null,
          logoUrl: null,
          grantablePermissions: [DOCUMENT_READ_PERMISSION, DOCUMENT_CREATE_PERMISSION],
        },
      },
    })
    expectResponse(created, 201)
    auth0Id = previousAuth0Id
    return created.body.data
  }

  describe("AppsRoutes.getInstall", () => {
    it("requires an authentication token", async () => {
      expectResponse(
        await request({
          route: AppsRoutes.getInstall,
          pathParams: { slug: "helpful-assistant" },
        }),
        401,
        AUTH_ERRORS.NO_ACCESS_TOKEN,
      )
    })

    it("rejects users without app.install", async () => {
      await createOrganizationWithProject(repositories, {
        user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
      })
      expectResponse(
        await request({
          route: AppsRoutes.getInstall,
          pathParams: { slug: "helpful-assistant" },
          token: "token",
        }),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })

    it("returns the app and back-office-visible projects for staff", async () => {
      const { project } = await createStaffInstaller()
      const manifest = await createManifest()

      const response = await request({
        route: AppsRoutes.getInstall,
        pathParams: { slug: manifest.slug },
        token: "token",
      })
      expectResponse(response, 200)
      expect(response.body.data.app).toMatchObject({
        name: "Helpful Assistant",
        slug: "helpful-assistant",
        grantablePermissions: [DOCUMENT_READ_PERMISSION, DOCUMENT_CREATE_PERMISSION],
      })
      expect(response.body.data.projects.map((installProject) => installProject.id)).toContain(
        project.id,
      )
    })
  })

  describe("AppsRoutes.authorize", () => {
    const redirectUri = "http://127.0.0.1:8787/callback"

    it("creates credentials once and refuses a second active install", async () => {
      const { project } = await createStaffInstaller()
      const manifest = await createManifest()

      const authorized = await request({
        route: AppsRoutes.authorize,
        pathParams: { slug: manifest.slug },
        token: "token",
        request: {
          payload: {
            projectId: project.id,
            permissions: [DOCUMENT_READ_PERMISSION],
            redirectUri,
            state: "csrf-state",
          },
        },
      })
      expectResponse(authorized, 201)
      expect(authorized.body.data.clientId).toBeTruthy()
      expect(authorized.body.data.clientSecret).toBeTruthy()
      expect(authorized.body.data.state).toBe("csrf-state")

      const installation = await repositories.appInstallationRepository.findOneByOrFail({
        clientId: authorized.body.data.clientId,
      })
      expect(installation.clientSecretHash).not.toContain(authorized.body.data.clientSecret)
      const serviceUser = await repositories.userRepository.findOneByOrFail({
        id: installation.serviceUserId ?? undefined,
      })
      expect(serviceUser.type).toBe(USER_TYPE_SERVICE)

      const permissionService = setup.module.get(PermissionService)
      await expect(
        permissionService.has(serviceUser.id, DOCUMENT_READ_PERMISSION, {
          type: "project",
          id: project.id,
        }),
      ).resolves.toBe(true)

      const conflict = await request({
        route: AppsRoutes.authorize,
        pathParams: { slug: manifest.slug },
        token: "token",
        request: {
          payload: {
            projectId: project.id,
            permissions: [DOCUMENT_READ_PERMISSION],
            redirectUri,
            state: "csrf-state",
          },
        },
      })
      expectResponse(conflict, 409)

      await repositories.appInstallationRepository.update(
        { id: installation.id },
        { status: APP_INSTALLATION_STATUS_REVOKED, revokedAt: new Date() },
      )

      const reinstall = await request({
        route: AppsRoutes.authorize,
        pathParams: { slug: manifest.slug },
        token: "token",
        request: {
          payload: {
            projectId: project.id,
            permissions: [DOCUMENT_READ_PERMISSION],
            redirectUri,
            state: "csrf-state-2",
          },
        },
      })
      expectResponse(reinstall, 201)
      expect(reinstall.body.data.clientId).not.toBe(authorized.body.data.clientId)
    })

    it("rejects a non-loopback redirect URI", async () => {
      const { project } = await createStaffInstaller()
      const manifest = await createManifest()
      expectResponse(
        await request({
          route: AppsRoutes.authorize,
          pathParams: { slug: manifest.slug },
          token: "token",
          request: {
            payload: {
              projectId: project.id,
              permissions: [DOCUMENT_READ_PERMISSION],
              redirectUri: "https://evil.example/callback",
              state: "csrf-state",
            },
          },
        }),
        400,
      )
    })
  })
})
