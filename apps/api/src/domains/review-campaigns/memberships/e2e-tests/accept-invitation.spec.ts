import { InvitationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { InvitationsModule } from "@/domains/invitations/invitations.module"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { userFactory } from "@/domains/users/user.factory"
import {
  mockAuth0EmailForSub,
  mockInvitationSender,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { reviewCampaignFactory } from "../../review-campaign.factory"
import { ReviewCampaignsModule } from "../../review-campaigns.module"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "../review-campaign-membership.factory"

describe("Invitations - acceptInvitation (review campaigns)", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|invitee-tester"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule, InvitationsModule, RbacModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    await ensureRbacCatalog(setup.module)
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
    const { organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const invitee = await repositories.userRepository.save(
      userFactory.build({ email: mockAuth0EmailForSub(auth0Id) }),
    )
    const membership = await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .tester()
        .transient({ organization, project, campaign, user: invitee })
        .build(),
    })
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
      invitedAt: membership.createdAt,
      acceptedAt: null,
    })
    return { organization, project, campaign, membership, invitee }
  }

  it("ensures the campaign membership exists after accept", async () => {
    const { campaign, invitee } = await seedInvitation()

    const response = await subject({ payload: { ticketId: "ticket_test" } })
    expectResponse(response, 201)

    const membership = await repositories.userMembershipRepository.findOne({
      where: {
        userId: invitee.id,
        resourceId: campaign.id,
        resourceType: "review_campaign",
      },
    })
    expect(membership).not.toBeNull()
  })

  it("ensures the invitee gets an organization membership (role: member)", async () => {
    const { organization, invitee } = await seedInvitation()

    await subject({ payload: { ticketId: "ticket_test" } })

    const orgMembership = await repositories.userMembershipRepository.findOne({
      where: {
        userId: invitee.id,
        resourceId: organization.id,
        resourceType: "organization",
      },
    })
    expect(orgMembership?.role).toBe("member")
    const orgMemberRole = await repositories.roleRepository.findOneOrFail({
      where: { key: ORGANIZATION_ROLES.member },
    })
    expect(orgMembership?.roleId).toBe(orgMemberRole.id)
  })

  it("ensures the invitee gets a project membership (role: member)", async () => {
    const { project, invitee } = await seedInvitation()

    await subject({ payload: { ticketId: "ticket_test" } })

    const projectMembership = await repositories.userMembershipRepository.findOne({
      where: {
        userId: invitee.id,
        resourceId: project.id,
        resourceType: "project",
      },
    })
    expect(projectMembership?.role).toBe("member")
  })

  it("is idempotent — second accept returns success without duplicating membership", async () => {
    const { membership, invitee, campaign } = await seedInvitation()

    const first = await subject({ payload: { ticketId: "ticket_test" } })
    expectResponse(first, 201)

    const after = await repositories.userMembershipRepository.findOne({
      where: { id: membership.id },
    })
    const firstCreatedAt = after?.createdAt

    const second = await subject({ payload: { ticketId: "ticket_test" } })
    expectResponse(second, 201)

    const memberships = await repositories.userMembershipRepository.find({
      where: {
        userId: invitee.id,
        resourceId: campaign.id,
        resourceType: "review_campaign",
      },
    })
    expect(memberships).toHaveLength(1)
    expect(memberships[0]?.createdAt.getTime()).toBe(firstCreatedAt?.getTime())
  })

  it("returns 404 for an unknown ticketId", async () => {
    await seedInvitation()
    const response = await subject({ payload: { ticketId: "unknown-ticket" } })
    expectResponse(response, 404)
  })
})
