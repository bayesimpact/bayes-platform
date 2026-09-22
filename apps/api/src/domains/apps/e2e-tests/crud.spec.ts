import { randomUUID } from "node:crypto"
import { AppsRoutes, DOCUMENT_READ_PERMISSION } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { APP_INSTALLATION_STATUS_ACTIVE } from "@/domains/apps/app-installation.entity"
import { appInstallationFactory } from "@/domains/apps/app-installation.factory"
import {
  createOrganizationWithOwner,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AppsModule } from "../apps.module"

describe("Apps - CRUD", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule, RbacModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
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
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
    })
    await assignPlatformSuperadminToUser({ repositories, user })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createPayload = {
    name: "Helpful Assistant",
    slug: "helpful-assistant",
    description: "A generic assistant used in tests.",
    logoUrl: null as string | null,
    grantablePermissions: [DOCUMENT_READ_PERMISSION],
  }

  const createApp = async (overrides: Partial<typeof createPayload> = {}) =>
    request({
      route: AppsRoutes.createOne,
      token: "token",
      request: { payload: { ...createPayload, ...overrides } },
    })

  it("creates, lists, fetches, and updates a manifest", async () => {
    const created = await createApp()
    expectResponse(created, 201)
    expect(created.body.data).toMatchObject({
      name: "Helpful Assistant",
      slug: "helpful-assistant",
      grantablePermissions: [DOCUMENT_READ_PERMISSION],
    })

    const listed = await request({ route: AppsRoutes.getAll, token: "token" })
    expectResponse(listed, 200)
    expect(listed.body.data.map((manifest) => manifest.slug)).toEqual(["helpful-assistant"])

    const fetched = await request({
      route: AppsRoutes.getOne,
      pathParams: { appManifestId: created.body.data.id },
      token: "token",
    })
    expectResponse(fetched, 200)
    expect(fetched.body.data.id).toBe(created.body.data.id)

    const updated = await request({
      route: AppsRoutes.updateOne,
      pathParams: { appManifestId: created.body.data.id },
      token: "token",
      request: { payload: { name: "Updated Assistant" } },
    })
    expectResponse(updated, 200)
    expect(updated.body.data.name).toBe("Updated Assistant")
  })

  it("rejects an invalid slug and unknown grantable permissions", async () => {
    const invalidSlug = await createApp({ slug: "Not A Slug" })
    expectResponse(invalidSlug, 400)

    const unknownPermission = await request({
      route: AppsRoutes.createOne,
      token: "token",
      request: {
        payload: {
          ...createPayload,
          slug: "unknown-permission",
          grantablePermissions: ["organization.delete" as typeof DOCUMENT_READ_PERMISSION],
        },
      },
    })
    expectResponse(unknownPermission, 400)
  })

  it("rejects a duplicate slug", async () => {
    expectResponse(await createApp(), 201)
    const duplicate = await createApp()
    expectResponse(duplicate, 409)
  })

  it("soft-deletes a manifest without active installations", async () => {
    const created = await createApp()
    expectResponse(created, 201)
    const deleted = await request({
      route: AppsRoutes.deleteOne,
      pathParams: { appManifestId: created.body.data.id },
      token: "token",
    })
    expectResponse(deleted, 200)
    expect(deleted.body.data.success).toBe(true)

    const fetched = await request({
      route: AppsRoutes.getOne,
      pathParams: { appManifestId: created.body.data.id },
      token: "token",
    })
    expectResponse(fetched, 404)
  })

  it("refuses to delete a manifest with active installations", async () => {
    const created = await createApp({ slug: "installed-assistant" })
    expectResponse(created, 201)
    const { project } = await createOrganizationWithProject(repositories)
    await repositories.appInstallationRepository.save(
      appInstallationFactory.build({
        appManifestId: created.body.data.id,
        projectId: project.id,
        status: APP_INSTALLATION_STATUS_ACTIVE,
      }),
    )
    const deleted = await request({
      route: AppsRoutes.deleteOne,
      pathParams: { appManifestId: created.body.data.id },
      token: "token",
    })
    expectResponse(deleted, 409)
  })

  it("returns 404 when updating a missing manifest", async () => {
    const updated = await request({
      route: AppsRoutes.updateOne,
      pathParams: { appManifestId: randomUUID() },
      token: "token",
      request: { payload: { name: "Missing" } },
    })
    expectResponse(updated, 404)
  })
})
