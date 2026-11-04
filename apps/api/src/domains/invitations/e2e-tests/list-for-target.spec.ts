import { randomUUID } from "node:crypto"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { invitationFactory } from "../invitation.factory"
import { InvitationsModule } from "../invitations.module"
import { type InvitationRouteTarget, invitationRoutesFor } from "./invitation-routes.helpers"
import { createWorkspaceWithTwoAgents } from "./workspace-invitation.helpers"

describe("Invitations - listForTarget", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async (target: InvitationRouteTarget) => {
    const { routes, pathParams } = invitationRoutesFor(target)
    return request({ route: routes.getAll, pathParams, token: "token" })
  }

  it("lists the pending invitations of the target only", async () => {
    const { project, agent } = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
    })
    const [pendingUser, acceptedUser, projectUser] = await repositories.userRepository.save([
      userFactory.build({ authSubject: null }),
      userFactory.build(),
      userFactory.build({ authSubject: null }),
    ])
    const pending = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: pendingUser!, agent }).build(),
    )
    await repositories.invitationRepository.save([
      invitationFactory.accepted().transient({ user: acceptedUser!, agent }).build(),
      invitationFactory.transient({ user: projectUser!, project }).build(),
    ])

    const response = await subject({ agent })

    expectResponse(response, 200)
    expect(response.body.data.invitations).toEqual([
      expect.objectContaining({
        id: pending.id,
        invitedEmail: pendingUser!.email,
        status: "pending",
        targetName: agent.name,
      }),
    ])
  })

  it("lists the pending invitations of a review campaign", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const reviewCampaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const invitedUser = await repositories.userRepository.save(
      userFactory.build({ authSubject: null }),
    )
    const invitation = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: invitedUser, reviewCampaign }).build(),
    )

    const response = await subject({ reviewCampaign })

    expectResponse(response, 200)
    expect(response.body.data.invitations).toEqual([
      expect.objectContaining({ id: invitation.id, targetName: reviewCampaign.name }),
    ])
  })

  it("lists on an agent the workspace invitations that give it", async () => {
    const { project, firstAgent, secondAgent } = await createWorkspaceWithTwoAgents(
      repositories,
      authSubject,
    )
    const [givingUser, otherUser] = await repositories.userRepository.save([
      userFactory.build({ authSubject: null }),
      userFactory.build({ authSubject: null }),
    ])
    const giving = await repositories.invitationRepository.save(
      invitationFactory
        .transient({ user: givingUser!, project })
        .build({ role: "member", agentIds: [firstAgent.id, secondAgent.id] }),
    )
    await repositories.invitationRepository.save(
      invitationFactory
        .transient({ user: otherUser!, project })
        .build({ role: "member", agentIds: [secondAgent.id] }),
    )

    const response = await subject({ agent: firstAgent })

    expectResponse(response, 200)
    expect(response.body.data.invitations).toEqual([
      expect.objectContaining({
        id: giving.id,
        targetType: "project",
        role: "member",
        agents: [
          { id: firstAgent.id, name: firstAgent.name },
          { id: secondAgent.id, name: secondAgent.name },
        ],
      }),
    ])
  })
})
