import { InvitationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { InvitationsModule } from "@/domains/invitations/invitations.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import {
  mockAuth0EmailForSub,
  mockInvitationSender,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { reviewCampaignFactory } from "../../review-campaign.factory"
import { ReviewCampaignsModule } from "../../review-campaigns.module"
import { reviewCampaignMembershipFactory } from "../review-campaign-membership.factory"

describe("Invitations - acceptInvitation (review campaigns)", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|invitee-tester"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule, InvitationsModule],
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
    auth0Id = "auth0|invitee-tester"
    mockInvitationSender.resetTicketCounter()
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async (payload?: typeof InvitationsRoutes.acceptOne.request) =>
    request({
      route: InvitationsRoutes.acceptOne,
      token: accessToken,
      request: payload,
    })

  const seedInvitation = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const agent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.active().transient({ organization, project, agent }).build(),
    )
    const invitee = await repositories.userRepository.save(
      userFactory.build({ email: mockAuth0EmailForSub(auth0Id) }),
    )
    const membership = await repositories.reviewCampaignMembershipRepository.save(
      reviewCampaignMembershipFactory
        .tester()
        .transient({ organization, project, campaign, user: invitee })
        .build({ invitationToken: "ticket_test" }),
    )
    await repositories.invitationRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      targetType: "review_campaign",
      targetId: campaign.id,
      userId: invitee.id,
      invitedEmail: invitee.email,
      role: membership.role,
      invitationToken: "ticket_test",
      status: "pending",
      invitedAt: membership.invitedAt,
      acceptedAt: null,
    })
    return { organization, project, campaign, membership, invitee }
  }

  it("marks the tester membership accepted", async () => {
    const { membership } = await seedInvitation()

    const response = await subject({ payload: { ticketId: "ticket_test" } })
    expectResponse(response, 201)

    const updated = await repositories.reviewCampaignMembershipRepository.findOne({
      where: { id: membership.id },
    })
    expect(updated?.acceptedAt).not.toBeNull()
  })

  it("ensures the invitee gets an organization membership (role: member)", async () => {
    const { organization, invitee } = await seedInvitation()

    await subject({ payload: { ticketId: "ticket_test" } })

    const orgMembership = await repositories.organizationMembershipRepository.findOne({
      where: { userId: invitee.id, organizationId: organization.id },
    })
    expect(orgMembership?.role).toBe("member")
  })

  it("ensures the invitee gets a project membership (role: member)", async () => {
    const { project, invitee } = await seedInvitation()

    await subject({ payload: { ticketId: "ticket_test" } })

    const projectMembership = await repositories.projectMembershipRepository.findOne({
      where: { userId: invitee.id, projectId: project.id },
    })
    expect(projectMembership?.role).toBe("member")
  })

  it("is idempotent — second accept returns success without re-stamping", async () => {
    const { membership } = await seedInvitation()

    const first = await subject({ payload: { ticketId: "ticket_test" } })
    expectResponse(first, 201)

    const after = await repositories.reviewCampaignMembershipRepository.findOne({
      where: { id: membership.id },
    })
    const firstAcceptedAt = after?.acceptedAt

    const second = await subject({ payload: { ticketId: "ticket_test" } })
    expectResponse(second, 201)

    const afterSecond = await repositories.reviewCampaignMembershipRepository.findOne({
      where: { id: membership.id },
    })
    expect(afterSecond?.acceptedAt?.getTime()).toBe(firstAcceptedAt?.getTime())
  })

  it("returns 404 for an unknown ticketId", async () => {
    await seedInvitation()
    const response = await subject({ payload: { ticketId: "unknown-ticket" } })
    expectResponse(response, 404)
  })
})
