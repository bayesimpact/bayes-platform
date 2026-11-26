import { randomUUID } from "node:crypto"
import { EvalMyInvitationsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
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
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

describe("Evaluation invitations - getMine", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
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

  const subject = async () => request({ route: EvalMyInvitationsRoutes.getMine, token: "token" })

  it("lists the caller's pending invitations with the names to show", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
      user: { authSubject: `oidc|${randomUUID()}` },
    })
    const [caller, someoneElse] = await repositories.userRepository.save([
      userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) }),
      userFactory.build(),
    ])
    const agentInvitation = await repositories.invitationRepository.save(
      invitationFactory.transient({ user: caller!, agent }).build(),
    )
    await repositories.invitationRepository.save([
      invitationFactory.revoked().transient({ user: caller!, project }).build(),
      invitationFactory.transient({ user: someoneElse!, project }).build(),
    ])

    const response = await subject()

    expectSchemaResponse(EvalMyInvitationsRoutes.getMine, response, 200)
    expect(response.body.data.invitations).toStrictEqual([
      {
        id: agentInvitation.id,
        organizationName: organization.name,
        projectName: project.name,
        targetType: "agent",
        targetName: agent.name,
        role: agentInvitation.role,
        status: "pending",
        invitedAt: expect.any(Number),
      },
    ])
  })

  it("hides invitations whose target was deleted", async () => {
    const { project } = await createOrganizationWithProject(repositories, {
      user: { authSubject: `oidc|${randomUUID()}` },
    })
    const caller = await repositories.userRepository.save(
      userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) }),
    )
    await repositories.invitationRepository.save(
      invitationFactory.transient({ user: caller, project }).build(),
    )
    await repositories.projectRepository.softDelete({ id: project.id })

    const response = await subject()

    expectSchemaResponse(EvalMyInvitationsRoutes.getMine, response, 200)
    expect(response.body.data.invitations).toEqual([])
  })
})
