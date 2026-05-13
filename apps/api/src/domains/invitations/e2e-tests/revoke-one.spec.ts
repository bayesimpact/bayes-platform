import { randomUUID } from "node:crypto"
import { InvitationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { InvitationsModule } from "../invitations.module"

describe("Invitations — revokeOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let invitationId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const seedPendingProjectInvitation = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    auth0Id = user.auth0Id
    const invitation = await repositories.invitationRepository.save(
      repositories.invitationRepository.create({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "project",
        targetId: project.id,
        userId: null,
        invitedEmail: "pending-invitee@example.com",
        invitationToken: `e2e-revoke-${randomUUID()}`,
        status: "pending",
        role: "admin",
        invitedAt: new Date(),
        acceptedAt: null,
      }),
    )
    invitationId = invitation.id
    return { user, organization, project, invitation }
  }

  const subject = async () =>
    request({
      route: InvitationsRoutes.revokeOne,
      pathParams: { invitationId },
      token: accessToken,
    })

  it("revokes a pending invitation and records activity", async () => {
    await seedPendingProjectInvitation()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { success: true } })

    const updated = await repositories.invitationRepository.findOne({
      where: { id: invitationId },
    })
    expect(updated!.status).toBe("revoked")
    await expectActivityCreated("invitation.revoke")
  })

  it("returns 404 when the invitation does not exist", async () => {
    await seedPendingProjectInvitation()
    invitationId = randomUUID()

    const response = await subject()

    expectResponse(response, 404)
  })

  it("returns 404 when the invitation is not pending", async () => {
    await seedPendingProjectInvitation()
    await repositories.invitationRepository.update({ id: invitationId }, { status: "accepted" })

    const response = await subject()

    expectResponse(response, 404)
  })
})
