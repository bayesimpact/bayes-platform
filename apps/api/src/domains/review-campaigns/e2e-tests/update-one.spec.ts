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
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { Project } from "@/domains/projects/project.entity"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { reviewCampaignFactory } from "../review-campaign.factory"
import { ReviewCampaignsModule } from "../review-campaigns.module"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-update" }),
}

describe("ReviewCampaigns - updateOne", () => {
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

  const createContext = async (): Promise<{
    organization: Organization
    project: Project
    agent: Agent
    agentSettings: AgentSettings
  }> => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { auth0Id },
      },
    )
    organizationId = organization.id
    projectId = project.id
    return { organization, project, agent, agentSettings }
  }

  const subject = async (payload: typeof ReviewCampaignsRoutes.updateOne.request) =>
    request({
      route: ReviewCampaignsRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: payload,
    })

  it("updates the name while in draft", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.transient({ organization, project, agent, agentSettings }).build(),
    )
    reviewCampaignId = campaign.id

    const response = await subject({ payload: { name: "Renamed" } })
    expectResponse(response, 200)
    expect(response.body.data.name).toBe("Renamed")
  })

  it("refuses config updates on an active campaign", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    reviewCampaignId = campaign.id

    expectResponse(await subject({ payload: { name: "Renamed" } }), 409)
  })

  it("transitions draft → active and stamps activatedAt", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.transient({ organization, project, agent, agentSettings }).build(),
    )
    reviewCampaignId = campaign.id

    const response = await subject({ payload: { status: "active" } })
    expectResponse(response, 200)
    expect(response.body.data.status).toBe("active")
    expect(response.body.data.activatedAt).not.toBeNull()
  })

  it("transitions active → closed and stamps closedAt", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    reviewCampaignId = campaign.id

    const response = await subject({ payload: { status: "closed" } })
    expectResponse(response, 200)
    expect(response.body.data.status).toBe("closed")
    expect(response.body.data.closedAt).not.toBeNull()
  })

  it("rejects invalid transitions (draft → closed)", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.transient({ organization, project, agent, agentSettings }).build(),
    )
    reviewCampaignId = campaign.id

    expectResponse(await subject({ payload: { status: "closed" } }), 409)
  })
})
