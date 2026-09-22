import { randomUUID } from "node:crypto"
import { AppsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AppsModule } from "../apps.module"

describe("Apps - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | null = "token"
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
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createSuperadmin = async () => {
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
    })
    await assignPlatformSuperadminToUser({ repositories, user })
    return user
  }

  const createStaff = async () => {
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
    })
    await assignPlatformStaffToUser({ repositories, user })
    return user
  }

  describe("AppsRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: AppsRoutes.getAll,
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without backoffice.app.manage", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
      })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("rejects platform staff", async () => {
      await createStaff()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows a superadmin to list apps", async () => {
      await createSuperadmin()
      expectResponse(await subject(), 200)
    })
  })

  describe("AppsRoutes.createOne", () => {
    const subject = async () =>
      request({
        route: AppsRoutes.createOne,
        token: accessToken ?? undefined,
        request: {
          payload: {
            name: "Helpful Assistant",
            slug: "helpful-assistant",
            description: null,
            logoUrl: null,
            grantablePermissions: ["document.read"],
          },
        },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects platform staff", async () => {
      await createStaff()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows a superadmin to create an app", async () => {
      await createSuperadmin()
      expectResponse(await subject(), 201)
    })
  })
})
