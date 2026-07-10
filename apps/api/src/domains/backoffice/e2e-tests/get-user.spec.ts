import { randomUUID } from "node:crypto"
import { BackofficeRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - get user", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

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

  const createAuthorizedContext = async () => {
    const email = mockAuth0EmailForSub(auth0Id)
    const context = await createOrganizationWithAgent(repositories, {
      user: { auth0Id, email },
    })
    process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@example.com"
    process.env.BACKOFFICE_AUTHORIZED_EMAILS = email
    return context
  }

  it("returns the user detail with organization, agent, and review campaign memberships", async () => {
    const { user, organization, project, agent, agentSettings } = await createAuthorizedContext()
    const reviewCampaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.transient({ organization, project, agent, agentSettings }).build({
        name: "Review campaign",
      }),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .reviewer()
        .transient({ organization, project, campaign: reviewCampaign, user })
        .build(),
    })

    const response = await request({
      route: BackofficeRoutes.getUser,
      pathParams: { userId: user.id },
      token: "token",
    })
    expectResponse(response, 200)
    const returned = response.body.data
    expect(returned.id).toBe(user.id)
    expect(returned.email).toBe(user.email)
    expect(returned.organizationMemberships).toEqual([
      {
        organizationId: organization.id,
        organizationName: organization.name,
        role: "owner",
      },
    ])
    expect(returned.projectMemberships).toEqual([
      {
        projectId: project.id,
        projectName: project.name,
        role: "owner",
      },
    ])
    expect(returned.agentMemberships).toEqual([
      {
        agentId: agent.id,
        agentName: agent.name,
        role: "owner",
      },
    ])
    expect(returned.reviewCampaignMemberships).toEqual([
      {
        campaignId: reviewCampaign.id,
        campaignName: reviewCampaign.name,
        role: "reviewer",
      },
    ])
  })

  it("returns empty membership lists for a user with no memberships", async () => {
    await createAuthorizedContext()
    const isolatedUser = await repositories.userRepository.save(
      repositories.userRepository.create({
        auth0Id: `auth0|${randomUUID()}`,
        email: `isolated-${randomUUID()}@example.com`,
        name: null,
        pictureUrl: null,
      }),
    )
    const response = await request({
      route: BackofficeRoutes.getUser,
      pathParams: { userId: isolatedUser.id },
      token: "token",
    })
    expectResponse(response, 200)
    expect(response.body.data.organizationMemberships).toEqual([])
    expect(response.body.data.projectMemberships).toEqual([])
    expect(response.body.data.agentMemberships).toEqual([])
    expect(response.body.data.reviewCampaignMemberships).toEqual([])
  })

  it("returns 404 for an unknown user id", async () => {
    await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.getUser,
      pathParams: { userId: randomUUID() },
      token: "token",
    })
    expectResponse(response, 404)
  })
})
