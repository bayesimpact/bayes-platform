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
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { mockForeignAuth0Id, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
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
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
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
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: "owner" | "admin" | "member" = "owner") => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
      projectMembership: { role },
    })
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    const campaign = reviewCampaignFactory.transient({ organization, project, agent }).build()
    await repositories.reviewCampaignRepository.save(campaign)
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    accessToken = "token"
    return { organization, project, agent, campaign }
  }

  describe("ReviewCampaignsRoutes.createOne", () => {
    const payload: typeof ReviewCampaignsRoutes.createOne.request = {
      payload: { agentId: randomUUID(), name: "new" },
    }
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: payload,
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
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
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
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
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
      auth0Id = mockForeignAuth0Id()
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
      auth0Id = mockForeignAuth0Id()
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
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
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
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("forbids project members without admin role", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
