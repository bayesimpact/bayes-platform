import { randomUUID } from "node:crypto"
import { ProjectInvitationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { InvitationsModule } from "../invitations.module"
import { createWorkspaceWithTwoAgents } from "./workspace-invitation.helpers"

describe("Invitations - getInviteeAccess", () => {
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

  const subject = (project: { id: string; organizationId: string }) =>
    request({
      route: ProjectInvitationsRoutes.getInviteeAccess,
      pathParams: { organizationId: project.organizationId, projectId: project.id },
      token: "token",
    })

  it("lists each person of the workspace with their highest role and their agents", async () => {
    const {
      user: owner,
      project,
      firstAgent,
      secondAgent,
    } = await createWorkspaceWithTwoAgents(repositories, authSubject)
    const { user: member } = await addUserToProject({ repositories, project })
    await addUserToAgent({ repositories, agent: secondAgent, user: member })

    const response = await subject(project)

    expectResponse(response, 200)
    expect(response.body.data.members).toEqual(
      expect.arrayContaining([
        {
          email: owner.email,
          workspaceRoleKey: "project_owner",
          agentIds: expect.arrayContaining([firstAgent.id, secondAgent.id]),
        },
        { email: member.email, workspaceRoleKey: "project_member", agentIds: [secondAgent.id] },
      ]),
    )
    expect(response.body.data.members).toHaveLength(2)
  })

  it("does not count a conversation reviewer grant as access to the agent", async () => {
    const { project, firstAgent } = await createWorkspaceWithTwoAgents(repositories, authSubject)
    const { user: member } = await addUserToProject({ repositories, project })
    await addUserToAgent({
      repositories,
      agent: firstAgent,
      user: member,
      membership: { roleKeys: ["agent_conversation_reviewer"] },
    })

    const response = await subject(project)

    expectResponse(response, 200)
    expect(response.body.data.members).toEqual(
      expect.arrayContaining([
        { email: member.email, workspaceRoleKey: "project_member", agentIds: [] },
      ]),
    )
  })
})
