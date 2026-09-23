import { randomUUID } from "node:crypto"
import { AppsRoutes, AppsV1Routes, DOCUMENT_READ_PERMISSION } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { APP_INSTALLATION_STATUS_REVOKED } from "@/domains/apps/app-installation.entity"
import { withDocumentEmbeddingsBatchServiceMock } from "@/domains/documents/test-overrides"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AppsModule } from "../apps.module"

describe("Apps - Revoke", () => {
  let app: INestApplication<App>
  let requester: Requester
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
    requester = testRequester(app)
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

  const createManifest = async () => {
    const superadminAuth0Id = `auth0|${randomUUID()}`
    const previousAuth0Id = auth0Id
    auth0Id = superadminAuth0Id
    const { user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id: superadminAuth0Id, email: mockAuth0EmailForSub(superadminAuth0Id) },
    })
    await assignPlatformSuperadminToUser({ repositories, user })
    const created = await requester({
      route: AppsRoutes.createOne,
      token: "token",
      request: {
        payload: {
          name: "Helpful Assistant",
          slug: "helpful-assistant",
          description: null,
          logoUrl: null,
          grantablePermissions: [DOCUMENT_READ_PERMISSION],
        },
      },
    })
    expectResponse(created, 201)
    auth0Id = previousAuth0Id
    return created.body.data
  }

  const install = async (projectId: string, slug: string) => {
    const authorized = await requester({
      route: AppsRoutes.authorize,
      pathParams: { slug },
      token: "token",
      request: {
        payload: {
          projectId,
          permissions: [DOCUMENT_READ_PERMISSION],
          redirectUri: "http://127.0.0.1:8787/callback",
          state: "csrf-state",
        },
      },
    })
    expectResponse(authorized, 201)
    return authorized.body.data
  }

  it("revokes the installation, blocks new tokens, and keeps the issued JWT until it expires", async () => {
    const { project } = await createStaffInstaller()
    const manifest = await createManifest()
    const credentials = await install(project.id, manifest.slug)
    const installation = await repositories.appInstallationRepository.findOneByOrFail({
      clientId: credentials.clientId,
    })
    const serviceUser = await repositories.userRepository.findOneByOrFail({
      id: installation.serviceUserId ?? undefined,
    })

    const issued = await request(app.getHttpServer())
      .post(AppsV1Routes.createToken.getPath())
      .set("Connection", "close")
      .type("form")
      .send({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      })
    expectResponse(issued, 200)

    const listed = await requester({
      route: AppsRoutes.listForProject,
      pathParams: { projectId: project.id },
      token: "token",
    })
    expectResponse(listed, 200)
    expect(listed.body.data).toEqual([
      expect.objectContaining({
        id: installation.id,
        appName: "Helpful Assistant",
        description: null,
        permissions: [DOCUMENT_READ_PERMISSION],
      }),
    ])

    const revoked = await requester({
      route: AppsRoutes.revoke,
      pathParams: { id: installation.id },
      token: "token",
    })
    expectResponse(revoked, 200)
    expect(revoked.body.data.success).toBe(true)

    const listedAfter = await requester({
      route: AppsRoutes.listForProject,
      pathParams: { projectId: project.id },
      token: "token",
    })
    expectResponse(listedAfter, 200)
    expect(listedAfter.body.data).toEqual([])

    const stored = await repositories.appInstallationRepository.findOneByOrFail({
      id: installation.id,
    })
    expect(stored.status).toBe(APP_INSTALLATION_STATUS_REVOKED)
    expect(stored.revokedAt).toBeInstanceOf(Date)
    expect(stored.clientId).toBe(credentials.clientId)
    expect(stored.clientSecretHash).toBe(installation.clientSecretHash)
    expect(stored.serviceUserId).toBe(serviceUser.id)
    expect(stored.customRoleId).toBe(installation.customRoleId)
    expect(stored.deletedAt).toBeNull()

    const serviceUserAfter = await repositories.userRepository.findOneByOrFail({
      id: serviceUser.id,
    })
    expect(serviceUserAfter.email).toBe(serviceUser.email)
    expect(serviceUserAfter.auth0Id).toBe(serviceUser.auth0Id)
    expect(serviceUserAfter.deletedAt).toBeNull()
    await expect(
      repositories.roleRepository.findOneByOrFail({ id: installation.customRoleId ?? undefined }),
    ).resolves.toMatchObject({ id: installation.customRoleId })

    expectResponse(
      await request(app.getHttpServer())
        .post(AppsV1Routes.createToken.getPath())
        .set("Connection", "close")
        .type("form")
        .send({
          grant_type: "client_credentials",
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }),
      401,
      "Invalid client credentials",
    )

    const me = await requester({
      route: AppsV1Routes.getMe,
      token: issued.body.access_token,
    })
    expectResponse(me, 200)
    expect(me.body.data.installationId).toBe(installation.id)

    const again = await requester({
      route: AppsRoutes.revoke,
      pathParams: { id: installation.id },
      token: "token",
    })
    expectResponse(again, 200)
    const storedAgain = await repositories.appInstallationRepository.findOneByOrFail({
      id: installation.id,
    })
    expect(storedAgain.revokedAt?.toISOString()).toBe(stored.revokedAt?.toISOString())

    const reinstall = await install(project.id, manifest.slug)
    expect(reinstall.clientId).not.toBe(credentials.clientId)
    const reinstalled = await repositories.appInstallationRepository.findOneByOrFail({
      clientId: reinstall.clientId,
    })
    expect(reinstalled.serviceUserId).not.toBe(serviceUser.id)
    const reinstalledUser = await repositories.userRepository.findOneByOrFail({
      id: reinstalled.serviceUserId ?? undefined,
    })
    expect(reinstalledUser.email).not.toBe(serviceUser.email)
    expect(reinstalledUser.auth0Id).not.toBe(serviceUser.auth0Id)
  })
})
