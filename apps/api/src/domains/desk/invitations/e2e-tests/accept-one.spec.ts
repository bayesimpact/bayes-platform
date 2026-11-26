import { randomUUID } from "node:crypto"
import { DeskInvitationsRoutes } from "@bayes-platform/desk-contracts"
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
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import {
  findAgentMembershipRow,
  findOrganizationMembershipRow,
  findProjectMembershipRow,
} from "../../../../../test/membership-test.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk invitations - acceptOne", () => {
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
    await ensureRbacCatalog(setup.module)
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
      route: DeskInvitationsRoutes.acceptOne,
      pathParams: { invitationId },
      token: "token",
    })

  const createInvitee = () =>
    repositories.userRepository.save(
      userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) }),
    )

  const createProjectInvitation = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject: `oidc|${randomUUID()}` },
    })
    const invitee = await createInvitee()
    const invitation = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: invitee, project }).build(),
    )
    return { organization, project, invitee, invitation }
  }

  it("gives project admin access, marks the invitation accepted and records the activity", async () => {
    const { organization, project, invitee, invitation } = await createProjectInvitation()

    const response = await subject(invitation.id)

    expectSchemaResponse(DeskInvitationsRoutes.acceptOne, response, 201)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(
      (await findProjectMembershipRow(repositories, { userId: invitee.id, projectId: project.id }))
        ?.roleKeys,
    ).toEqual(["project_admin"])
    expect(
      (
        await findOrganizationMembershipRow(repositories, {
          userId: invitee.id,
          organizationId: organization.id,
        })
      )?.roleKeys,
    ).toEqual(["org_member"])
    const acceptedInvitation = await repositories.invitationRepository.findOneByOrFail({
      id: invitation.id,
    })
    expect(acceptedInvitation.status).toBe("accepted")
    await expectActivityCreated("invitation.accept", { userId: invitee.id })
  })

  it("gives agent member access for an agent invitation", async () => {
    const { agent } = await createOrganizationWithAgent(repositories, {
      user: { authSubject: `oidc|${randomUUID()}` },
    })
    const invitee = await createInvitee()
    const invitation = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: invitee, agent }).build(),
    )

    expectSchemaResponse(DeskInvitationsRoutes.acceptOne, await subject(invitation.id), 201)

    expect(
      (await findAgentMembershipRow(repositories, { userId: invitee.id, agentId: agent.id }))
        ?.roleKeys,
    ).toEqual(["agent_member"])
  })

  it("does nothing the second time", async () => {
    const { invitation } = await createProjectInvitation()
    expectResponse(await subject(invitation.id), 201)

    expectResponse(await subject(invitation.id), 201)
  })

  it("answers 404 for someone else's invitation", async () => {
    const { invitation } = await createProjectInvitation()
    authSubject = `oidc|${randomUUID()}`

    expectResponse(await subject(invitation.id), 404)
    expect(
      (await repositories.invitationRepository.findOneByOrFail({ id: invitation.id })).status,
    ).toBe("pending")
  })

  it("answers 404 for an unknown invitation", async () => {
    await createProjectInvitation()

    expectResponse(await subject(randomUUID()), 404)
  })

  it("answers 409 for a revoked invitation", async () => {
    const { project, invitee, invitation } = await createProjectInvitation()
    await repositories.invitationRepository.update({ id: invitation.id }, { status: "revoked" })

    expectResponse(await subject(invitation.id), 409)
    expect(
      await findProjectMembershipRow(repositories, { userId: invitee.id, projectId: project.id }),
    ).toBeNull()
  })

  it("answers 400 for an invitation id that is not a UUID", async () => {
    await createProjectInvitation()

    expectResponse(await subject("not-a-uuid"), 400)
  })
})
