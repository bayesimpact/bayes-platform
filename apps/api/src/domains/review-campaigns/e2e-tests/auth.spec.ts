import { randomUUID } from "node:crypto"
import { ReviewCampaignsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "../memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "../review-campaign.factory"
import { ReviewCampaignsModule } from "../review-campaigns.module"

describe("ReviewCampaigns - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let reviewCampaignId: string | null = randomUUID()
  let membershipId: string = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    reviewCampaignId = randomUUID()
    membershipId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: "owner" | "admin" | "member" = "owner") => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
        projectMembership: { role },
      },
    )
    authSubject = user.authSubject!
    const campaign = reviewCampaignFactory
      .transient({ organization, project, agent, agentSettings })
      .build()
    await repositories.reviewCampaignRepository.save(campaign)
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    accessToken = "token"
    return { organization, project, user, agent, campaign }
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
  }: Awaited<ReturnType<typeof createContextForRole>>) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { role: "admin" },
    })
    authSubject = organizationAdminAuthSubject
  }

  describe("ReviewCampaignsRoutes.createOne", () => {
    const payload: typeof ReviewCampaignsRoutes.createOne.request = {
      payload: { agentId: randomUUID(), name: "new" },
    }
    const subject = async (createPayload = payload) =>
      request({
        route: ReviewCampaignsRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: createPayload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["owner"], ["admin"]] as const)("allows a project %s", async (role) => {
      const { agent } = await createContextForRole(role)
      expectResponse(await subject({ payload: { agentId: agent.id, name: "new" } }), 201)
    })
  })

  describe("ReviewCampaignsRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["owner"], ["admin"]] as const)("allows a project %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  describe("ReviewCampaignsRoutes.getOne", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.getOne,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("returns 404 when the campaign is not in this project", async () => {
      await createContextForRole("owner")
      reviewCampaignId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["owner"], ["admin"]] as const)("allows a project %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  describe("ReviewCampaignsRoutes.updateOne", () => {
    const payload: typeof ReviewCampaignsRoutes.updateOne.request = {
      payload: { name: "renamed" },
    }
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.updateOne,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
        token: accessToken ?? undefined,
        request: payload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("returns 404 when the campaign is not in this project", async () => {
      await createContextForRole("owner")
      reviewCampaignId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["owner"], ["admin"]] as const)("allows a project %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  describe("ReviewCampaignsRoutes.deleteOne", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["owner"], ["admin"]] as const)("allows a project %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  describe("ReviewCampaignsRoutes.revokeMembership", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.revokeMembership,
        pathParams: removeNullish({
          organizationId,
          projectId,
          reviewCampaignId,
          membershipId,
        }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["owner"], ["admin"]] as const)("allows a project %s", async (role) => {
      const { organization, project, user, campaign } = await createContextForRole(role)
      const membership = await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .tester()
          .transient({ organization, project, campaign, user })
          .build(),
      })
      membershipId = membership.id
      expectResponse(await subject(), 200)
    })
  })
})
