import { randomUUID } from "node:crypto"
import { BackofficeRoutes } from "@caseai-connect/api-contracts"
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
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule, RbacModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
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
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createAuthorizedUser = async () => {
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    await assignPlatformSuperadminToUser({ repositories, user })
    return user
  }

  describe("BackofficeRoutes.listOrganizations", () => {
    const subject = async () =>
      request({
        route: BackofficeRoutes.listOrganizations,
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without the backoffice.read permission", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows authorized users to list organizations", async () => {
      await createAuthorizedUser()
      expectResponse(await subject(), 200)
    })
  })

  describe("BackofficeRoutes.listUsers", () => {
    const subject = async () =>
      request({
        route: BackofficeRoutes.listUsers,
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without the backoffice.read permission", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows authorized users to list users", async () => {
      await createAuthorizedUser()
      expectResponse(await subject(), 200)
    })
  })

  describe("BackofficeRoutes.getRbacCatalog", () => {
    const subject = async () =>
      request({
        route: BackofficeRoutes.getRbacCatalog,
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without the backoffice.read permission", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows authorized users to read the RBAC catalog", async () => {
      await createAuthorizedUser()
      expectResponse(await subject(), 200)
    })
  })

  describe("BackofficeRoutes.listAgents", () => {
    const subject = async () =>
      request({
        route: BackofficeRoutes.listAgents,
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without the backoffice.read permission", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows authorized users to list agents", async () => {
      await createAuthorizedUser()
      expectResponse(await subject(), 200)
    })
  })

  describe("BackofficeRoutes.listProjects", () => {
    const subject = async () =>
      request({
        route: BackofficeRoutes.listProjects,
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without the backoffice.read permission", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows authorized users to list projects", async () => {
      await createAuthorizedUser()
      expectResponse(await subject(), 200)
    })
  })

  describe("BackofficeRoutes.getUser", () => {
    const subject = async (userId: string) =>
      request({
        route: BackofficeRoutes.getUser,
        pathParams: { userId },
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(randomUUID()), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without the backoffice.read permission", async () => {
      const { user } = await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(user.id), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows authorized users to read a user", async () => {
      const user = await createAuthorizedUser()
      expectResponse(await subject(user.id), 200)
    })
  })

  describe("BackofficeRoutes.getOrganization", () => {
    const subject = async (organizationId: string) =>
      request({
        route: BackofficeRoutes.getOrganization,
        pathParams: { organizationId },
        token: accessToken ?? undefined,
      })

    it("rejects an organization owner without backoffice.read, despite their scoped backoffice.organization.read", async () => {
      const { organization } = await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(organization.id), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("BackofficeRoutes.createOrganization", () => {
    const subject = async () =>
      request({
        route: BackofficeRoutes.createOrganization,
        token: accessToken ?? undefined,
        request: { payload: { name: "Sample Organization" } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without the backoffice.read permission", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows authorized users to create an organization", async () => {
      await createAuthorizedUser()
      expectResponse(await subject(), 201)
    })
  })

  describe("BackofficeRoutes.addFeatureFlag", () => {
    const subject = async (projectId: string) =>
      request({
        route: BackofficeRoutes.addFeatureFlag,
        pathParams: { projectId },
        token: accessToken ?? undefined,
        request: { payload: { featureFlagKey: "evaluation" } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(randomUUID()), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without the backoffice.read permission", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(randomUUID()), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("BackofficeRoutes.removeFeatureFlag", () => {
    const subject = async (projectId: string) =>
      request({
        route: BackofficeRoutes.removeFeatureFlag,
        pathParams: { projectId, featureFlagKey: "evaluation" },
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(randomUUID()), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects users without the backoffice.read permission", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(await subject(randomUUID()), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
