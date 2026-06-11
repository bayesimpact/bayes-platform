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
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | null = "token"
  let auth0Id = `auth0|${randomUUID()}`

  const originalAuthorizedEmails = process.env.BACKOFFICE_AUTHORIZED_EMAILS
  const originalAuthorizedDomain = process.env.BACKOFFICE_AUTHORIZED_DOMAIN

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
    delete process.env.BACKOFFICE_AUTHORIZED_DOMAIN
    delete process.env.BACKOFFICE_AUTHORIZED_EMAILS
  })

  afterEach(() => {
    if (originalAuthorizedEmails === undefined) {
      delete process.env.BACKOFFICE_AUTHORIZED_EMAILS
    } else {
      process.env.BACKOFFICE_AUTHORIZED_EMAILS = originalAuthorizedEmails
    }
    if (originalAuthorizedDomain === undefined) {
      delete process.env.BACKOFFICE_AUTHORIZED_DOMAIN
    } else {
      process.env.BACKOFFICE_AUTHORIZED_DOMAIN = originalAuthorizedDomain
    }
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createAuthorizedUser = async () => {
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
    })
    process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@example.com"
    process.env.BACKOFFICE_AUTHORIZED_EMAILS = user.email
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

    it("rejects users whose email domain is not in BACKOFFICE_AUTHORIZED_DOMAIN", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
      })
      process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@other-domain.test"
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("rejects when BACKOFFICE_AUTHORIZED_DOMAIN is unset", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
      })
      delete process.env.BACKOFFICE_AUTHORIZED_DOMAIN
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

    it("rejects users whose email domain is not in BACKOFFICE_AUTHORIZED_DOMAIN", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
      })
      process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@other-domain.test"
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows authorized users to list users", async () => {
      await createAuthorizedUser()
      expectResponse(await subject(), 200)
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

    it("rejects unauthorized users", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
      })
      process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@other-domain.test"
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

    it("rejects unauthorized users", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
      })
      process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@other-domain.test"
      expectResponse(await subject(randomUUID()), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("BackofficeRoutes.replaceProjectSessionCategories", () => {
    const subject = async (projectId: string) =>
      request({
        route: BackofficeRoutes.replaceProjectSessionCategories,
        pathParams: { projectId },
        token: accessToken ?? undefined,
        request: { payload: { categoryNames: ["Billing"] } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(randomUUID()), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("rejects unauthorized users", async () => {
      await createOrganizationWithOwner(repositories, {
        user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
      })
      process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@other-domain.test"
      expectResponse(await subject(randomUUID()), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
