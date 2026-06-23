import { randomUUID } from "node:crypto"
import { ReviewCampaignsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "../memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "../review-campaign.factory"
import { ReviewCampaignsModule } from "../review-campaigns.module"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-get" }),
}

describe("ReviewCampaigns - getOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let accessToken: string = "token"
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider(INVITATION_SENDER)
          .useValue(mockInvitationSender),
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
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async () =>
    request({
      route: ReviewCampaignsRoutes.getOne,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })

  it("returns the campaign with its memberships", async () => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    const campaign = reviewCampaignFactory
      .transient({ organization, project, agent })
      .build({ name: "Detail" })
    await repositories.reviewCampaignRepository.save(campaign)

    const membership = await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .tester()
        .transient({ organization, project, campaign, user })
        .build(),
    })

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({ id: campaign.id, name: "Detail" })
    expect(response.body.data.memberships).toHaveLength(1)
    expect(response.body.data.memberships[0]).toMatchObject({
      id: membership.id,
      role: "tester",
      userEmail: user.email,
    })
  })

  it("returns 404 when the campaign belongs to a different project", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    const { organization: otherOrg, project: otherProject } =
      await createOrganizationWithProject(repositories)
    const otherAgent = agentFactory
      .transient({ organization: otherOrg, project: otherProject })
      .build()
    await repositories.agentRepository.save(otherAgent)
    const otherCampaign = reviewCampaignFactory
      .transient({ organization: otherOrg, project: otherProject, agent: otherAgent })
      .build()
    await repositories.reviewCampaignRepository.save(otherCampaign)

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = otherCampaign.id

    expectResponse(await subject(), 404)
  })
})
