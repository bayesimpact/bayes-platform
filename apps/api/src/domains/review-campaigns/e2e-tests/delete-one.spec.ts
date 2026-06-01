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
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { reviewCampaignFactory } from "../review-campaign.factory"
import { ReviewCampaignsModule } from "../review-campaigns.module"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-delete" }),
}

describe("ReviewCampaigns - deleteOne", () => {
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
      route: ReviewCampaignsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })

  it("soft-deletes a draft campaign", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { auth0Id },
      },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.transient({ organization, project, agent, agentSettings }).build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    expectResponse(await subject(), 200)
    const found = await repositories.reviewCampaignRepository.findOne({
      where: { id: campaign.id },
    })
    expect(found).toBeNull()
  })

  it("refuses to delete an active campaign", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { auth0Id },
      },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.active().transient({ organization, project, agent, agentSettings }).build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    expectResponse(await subject(), 409)
  })
})
