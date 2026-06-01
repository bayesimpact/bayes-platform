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
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { ReviewCampaignsModule } from "../review-campaigns.module"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-create" }),
}

describe("ReviewCampaigns - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
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

  const createContext = async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
      user: { auth0Id },
    })
    organizationId = organization.id
    projectId = project.id
    return { organization, project, agent }
  }

  const subject = async (payload: typeof ReviewCampaignsRoutes.createOne.request) =>
    request({
      route: ReviewCampaignsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("creates a campaign in draft status", async () => {
    const { agent } = await createContext()
    const response = await subject({ payload: { agentId: agent.id, name: "My Campaign" } })
    expectResponse(response, 201)
    expect(response.body.data).toMatchObject({
      name: "My Campaign",
      status: "draft",
      agentId: agent.id,
      activatedAt: null,
      closedAt: null,
    })

    const persisted = await repositories.reviewCampaignRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(persisted).not.toBeNull()
  })

  it("rejects an empty name", async () => {
    const { agent } = await createContext()
    expectResponse(await subject({ payload: { agentId: agent.id, name: "  " } }), 422)
  })

  it("rejects an agent from another project", async () => {
    await createContext()
    const { organization: otherOrg, project: otherProject } =
      await createOrganizationWithProject(repositories)
    const otherAgent = agentFactory
      .transient({ organization: otherOrg, project: otherProject })
      .build()
    await repositories.agentRepository.save(otherAgent)

    expectResponse(await subject({ payload: { agentId: otherAgent.id, name: "Bad" } }), 422)
  })
})
