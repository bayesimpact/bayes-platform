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
import { userFactory } from "@/domains/users/user.factory"
import { mockInvitationSender, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { InvitationsModule } from "../invitations.module"

describe("Invitations — createForTarget (project)", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let projectId: string
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

  const createContext = async () => {
    const { user, project } = await createOrganizationWithProject(repositories)
    projectId = project.id
    auth0Id = user.auth0Id
    return { project, user }
  }

  const subject = async (payload?: typeof InvitationsRoutes.createForTarget.request) =>
    request({
      route: InvitationsRoutes.createForTarget,
      token: accessToken,
      request: payload,
    })

  it("should invite a new email (pending invitation; user created on accept)", async () => {
    await createContext()

    const response = await subject({
      payload: {
        targetType: "project",
        targetId: projectId,
        emails: ["newuser@example.com"],
      },
    })

    expectResponse(response, 201)
    const invitations = response.body.data.invitations
    expect(invitations).toHaveLength(1)
    expect(invitations[0]!.invitedEmail).toBe("newuser@example.com")
    expect(invitations[0]!.status).toBe("pending")
    expect(invitations[0]!.userId).toBeNull()

    const createdUser = await repositories.userRepository.findOne({
      where: { email: "newuser@example.com" },
    })
    expect(createdUser).toBeNull()

    await expectActivityCreated("invitation.invite")
  })

  it("should invite an existing user (links invitation to userId)", async () => {
    await createContext()

    const existingUser = userFactory.build({
      email: "existing@example.com",
      name: "Existing User",
    })
    await repositories.userRepository.save(existingUser)

    const response = await subject({
      payload: {
        targetType: "project",
        targetId: projectId,
        emails: ["existing@example.com"],
      },
    })

    expectResponse(response, 201)
    const invitations = response.body.data.invitations
    expect(invitations).toHaveLength(1)
    expect(invitations[0]!.invitedEmail).toBe("existing@example.com")
    expect(invitations[0]!.userId).toBe(existingUser.id)
  })

  it("should call the invitation sender for each invited user", async () => {
    await createContext()

    await subject({
      payload: {
        targetType: "project",
        targetId: projectId,
        emails: ["user1@example.com", "user2@example.com"],
      },
    })

    expect(mockInvitationSender.sendInvitation).toHaveBeenCalledTimes(2)
    expect(mockInvitationSender.sendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteeEmail: "user1@example.com",
        inviterName: expect.any(String),
      }),
    )
    expect(mockInvitationSender.sendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteeEmail: "user2@example.com",
        inviterName: expect.any(String),
      }),
    )
  })
})
