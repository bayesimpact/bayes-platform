import { randomUUID } from "node:crypto"
import { MyInvitationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { findProjectMembershipRow } from "../../../../test/membership-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { invitationFactory } from "../invitation.factory"
import { InvitationsModule } from "../invitations.module"

describe("Invitations - declineOne", () => {
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

  const subject = async (invitationId: string) =>
    request({
      route: MyInvitationsRoutes.declineOne,
      pathParams: { invitationId },
      token: "token",
    })

  const createContext = async () => {
    const { project } = await createOrganizationWithProject(repositories, {
      user: { authSubject: `oidc|${randomUUID()}` },
    })
    const invitee = await repositories.userRepository.save(
      userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) }),
    )
    const invitation = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: invitee, project }).build(),
    )
    return { project, invitee, invitation }
  }

  it("declines without giving access, and hides the invitation", async () => {
    const { project, invitee, invitation } = await createContext()

    expectResponse(await subject(invitation.id), 201)

    expect(
      (await repositories.invitationRepository.findOneByOrFail({ id: invitation.id })).status,
    ).toBe("declined")
    expect(
      await findProjectMembershipRow(repositories, { userId: invitee.id, projectId: project.id }),
    ).toBeNull()
    const mine = await request({ route: MyInvitationsRoutes.getAll, token: "token" })
    expect(mine.body.data.invitations).toEqual([])
  })

  it("does nothing the second time", async () => {
    const { invitation } = await createContext()
    expectResponse(await subject(invitation.id), 201)

    expectResponse(await subject(invitation.id), 201)
  })

  it("cannot decline an accepted invitation", async () => {
    const { invitation } = await createContext()
    await repositories.invitationRepository.update({ id: invitation.id }, { status: "accepted" })

    expectResponse(await subject(invitation.id), 409)
  })

  it("answers 404 for someone else's invitation", async () => {
    const { invitation } = await createContext()
    authSubject = `oidc|${randomUUID()}`

    expectResponse(await subject(invitation.id), 404)
  })
})
