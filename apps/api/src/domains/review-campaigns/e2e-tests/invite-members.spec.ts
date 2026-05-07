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
import { reviewCampaignFactory } from "../review-campaign.factory"
import { ReviewCampaignsModule } from "../review-campaigns.module"

let inviteTicketSerial = 0
const mockInvitationSender = {
  sendInvitation: jest.fn().mockImplementation(() => {
    inviteTicketSerial += 1
    return Promise.resolve({ ticketId: `ticket-invite-${inviteTicketSerial}` })
  }),
}

describe("ReviewCampaigns - inviteMembers", () => {
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
    inviteTicketSerial = 0
    mockInvitationSender.sendInvitation.mockClear()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async (payload: typeof ReviewCampaignsRoutes.inviteMembers.request) =>
    request({
      route: ReviewCampaignsRoutes.inviteMembers,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: payload,
    })

  const seed = async (opts: { active?: boolean; closed?: boolean } = {}) => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    const factory = opts.closed
      ? reviewCampaignFactory.closed()
      : opts.active
        ? reviewCampaignFactory.active()
        : reviewCampaignFactory
    const campaign = await repositories.reviewCampaignRepository.save(
      factory.transient({ organization, project, agent }).build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, agent, campaign }
  }

  it("creates pending memberships and calls the invitation sender", async () => {
    await seed({ active: true })
    const response = await subject({
      payload: { role: "tester", emails: ["a@example.com", "b@example.com"] },
    })
    expectResponse(response, 201)
    expect(response.body.data.memberships).toHaveLength(2)
    expect(
      response.body.data.memberships.every((m) => m.role === "tester" && m.acceptedAt === null),
    ).toBe(true)
    expect(mockInvitationSender.sendInvitation).toHaveBeenCalledTimes(2)
  })

  it("skips duplicates for the same (campaign, user, role)", async () => {
    await seed({ active: true })
    await subject({ payload: { role: "tester", emails: ["dup@example.com"] } })
    const response = await subject({ payload: { role: "tester", emails: ["dup@example.com"] } })
    expectResponse(response, 201)
    expect(response.body.data.memberships).toHaveLength(0)
  })

  it("refuses to invite on a closed campaign", async () => {
    await seed({ closed: true })
    expectResponse(await subject({ payload: { role: "tester", emails: ["x@example.com"] } }), 409)
  })

  // Inviting on draft used to be allowed, but the invitee would accept and land
  // on an empty /tester or /reviewer (those listings filter to active campaigns).
  // Forcing activation first keeps invitees from being sent to a dead-end UI.
  it("refuses to invite on a draft campaign", async () => {
    await seed({})
    const response = await subject({ payload: { role: "tester", emails: ["x@example.com"] } })
    expectResponse(response, 409)
    expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
  })
})
