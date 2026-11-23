import { randomUUID } from "node:crypto"
import { DeskInvitationsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { invitationFactory } from "@/domains/invitations/invitation.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { findProjectMembershipRow } from "../../../../../test/membership-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk invitations - declineOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
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
      route: DeskInvitationsRoutes.declineOne,
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

  it("declines without giving access, hides the invitation and records the activity", async () => {
    const { project, invitee, invitation } = await createContext()

    const response = await subject(invitation.id)

    expectSchemaResponse(DeskInvitationsRoutes.declineOne, response, 201)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(
      (await repositories.invitationRepository.findOneByOrFail({ id: invitation.id })).status,
    ).toBe("declined")
    expect(
      await findProjectMembershipRow(repositories, { userId: invitee.id, projectId: project.id }),
    ).toBeNull()
    const mine = await request({ route: DeskInvitationsRoutes.getMine, token: "token" })
    expect(mine.body.data.invitations).toEqual([])
    await expectActivityCreated("invitation.decline", { userId: invitee.id })
  })

  it("does nothing the second time", async () => {
    const { invitation } = await createContext()
    expectResponse(await subject(invitation.id), 201)

    expectResponse(await subject(invitation.id), 201)
  })

  it("answers 409 for an accepted invitation", async () => {
    const { invitation } = await createContext()
    await repositories.invitationRepository.update({ id: invitation.id }, { status: "accepted" })

    expectResponse(await subject(invitation.id), 409)
  })

  it("answers 404 for someone else's invitation", async () => {
    const { invitation } = await createContext()
    authSubject = `oidc|${randomUUID()}`

    expectResponse(await subject(invitation.id), 404)
  })

  it("answers 400 for an invitation id that is not a UUID", async () => {
    await createContext()

    expectResponse(await subject("not-a-uuid"), 400)
  })
})
