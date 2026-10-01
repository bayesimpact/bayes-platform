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
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { invitationFactory } from "../invitation.factory"
import { InvitationsModule } from "../invitations.module"

describe("Invitations - revokeOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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

  const subject = async (invitationId: string) =>
    request({
      route: InvitationsRoutes.revokeOne,
      pathParams: { invitationId },
      token: "token",
    })

  const createContext = async (invitee: { authSubject: string | null }) => {
    const { project } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
    })
    const invitedUser = await repositories.userRepository.save(userFactory.build(invitee))
    const invitation = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: invitedUser, project }).build(),
    )
    return { invitedUser, invitation }
  }

  it("revokes the invitation and removes the account of a person who never signed in", async () => {
    const { invitedUser, invitation } = await createContext({ authSubject: null })

    expectResponse(await subject(invitation.id), 200)

    expect(
      (await repositories.invitationRepository.findOneByOrFail({ id: invitation.id })).status,
    ).toBe("revoked")
    expect(await repositories.userRepository.findOneBy({ id: invitedUser.id })).toBeNull()
    await expectActivityCreated("invitation.revoke")
  })

  it("keeps the account of a person who already signed in", async () => {
    const { invitedUser, invitation } = await createContext({ authSubject: `oidc|${randomUUID()}` })

    expectResponse(await subject(invitation.id), 200)

    expect(await repositories.userRepository.findOneBy({ id: invitedUser.id })).not.toBeNull()
  })

  it("keeps the account of a person who never signed in while another invitation is pending", async () => {
    const { invitedUser, invitation } = await createContext({ authSubject: null })
    const { project: otherProject } = await createOrganizationWithProject(repositories)
    await repositories.invitationRepository.save(
      invitationFactory.transient({ user: invitedUser, project: otherProject }).build(),
    )

    expectResponse(await subject(invitation.id), 200)

    expect(await repositories.userRepository.findOneBy({ id: invitedUser.id })).not.toBeNull()
  })

  it("answers 404 for an invitation that is no longer pending", async () => {
    const { invitation } = await createContext({ authSubject: null })
    await repositories.invitationRepository.update({ id: invitation.id }, { status: "accepted" })

    expectResponse(await subject(invitation.id), 404)
  })
})
