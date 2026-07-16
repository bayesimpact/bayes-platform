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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import {
  mockAuth0EmailForSub,
  mockInvitationSender,
  setupUserGuardForTesting,
} from "../../../../test/e2e.helpers"
import { ensureOrganizationRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { inviteUserToProject } from "../../projects/memberships/project-membership.factory"
import { ProjectsModule } from "../../projects/projects.module"

describe("Invitations - acceptInvitation", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|invitee-user"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule, InvitationsModule, RbacModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    await ensureOrganizationRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|invitee-user"
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

  const createInvitation = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)

    const { membership, invitedUser, invitationToken } = await inviteUserToProject({
      repositories,
      project,
      user: {
        email: mockAuth0EmailForSub(auth0Id),
      },
      projectMembership: {},
    })
    await repositories.invitationRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      targetType: "project",
      targetId: project.id,
      userId: invitedUser.id,
      invitedEmail: invitedUser.email,
      role: "admin",
      invitationToken,
      status: "pending",
      invitedAt: membership.createdAt,
      acceptedAt: null,
    })
    return { membership, ticketId: invitationToken, organization, project }
  }

  it("should accept an invitation and return success", async () => {
    const { ticketId } = await createInvitation()

    const response = await subject({ payload: { ticketId } })

    expectResponse(response, 201)
    expect(response.body.data).toEqual({ success: true })
  })

  it("should mark the invitation as accepted", async () => {
    const { ticketId } = await createInvitation()

    await subject({ payload: { ticketId } })

    const updatedInvitation = await repositories.invitationRepository.findOne({
      where: { invitationToken: ticketId },
    })

    expect(updatedInvitation).toBeDefined()
    expect(updatedInvitation!.status).toBe("accepted")
    expect(updatedInvitation!.acceptedAt).not.toBeNull()
  })

  it("should create an organization membership for the invitee", async () => {
    const { ticketId, membership, organization } = await createInvitation()

    await subject({ payload: { ticketId } })

    const orgMembership = await repositories.userMembershipRepository.findOne({
      where: {
        userId: membership.userId,
        resourceId: organization.id,
        resourceType: "organization",
      },
    })

    expect(orgMembership).toBeDefined()
    expect(orgMembership!.role).toBe("admin")
    const orgAdminRole = await repositories.roleRepository.findOneOrFail({
      where: { key: ORGANIZATION_ROLES.admin },
    })
    expect(orgMembership!.roleId).toBe(orgAdminRole.id)
  })

  it("should return 404 for an unknown ticketId", async () => {
    const response = await subject({ payload: { ticketId: "non-existent-ticket" } })

    expectResponse(response, 404)
  })

  it("should be idempotent — accepting an already accepted invitation returns success", async () => {
    const { ticketId } = await createInvitation()

    // Accept first time
    const firstResponse = await subject({ payload: { ticketId } })
    expectResponse(firstResponse, 201)

    // Accept again
    const secondResponse = await subject({ payload: { ticketId } })
    expectResponse(secondResponse, 201)
    expect(secondResponse.body.data).toEqual({ success: true })
  })

  it("should return 404 when ticketId does not match any invitation", async () => {
    const response = await subject({ payload: { ticketId: "any-ticket" } })

    expectResponse(response, 404)
  })
})
