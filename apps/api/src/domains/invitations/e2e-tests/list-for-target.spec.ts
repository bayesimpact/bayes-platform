import { randomUUID } from "node:crypto"
import { InvitationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { invitationFactory } from "../invitation.factory"
import { InvitationsModule } from "../invitations.module"

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

  const subject = async (query: { targetType: string; targetId: string }) =>
    request({ route: InvitationsRoutes.listForTarget, token: "token", query })

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

    const response = await subject({ targetType: "agent", targetId: agent.id })

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

  it("requires targetType and targetId", async () => {
    await createOrganizationWithAgent(repositories, { user: { authSubject } })

    expectResponse(await request({ route: InvitationsRoutes.listForTarget, token: "token" }), 400)
  })
})
