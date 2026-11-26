import { randomUUID } from "node:crypto"
import { DeskConversationsRoutes } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addMemberByEmailToProject } from "@/domains/projects/memberships/project-membership.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk conversations - createOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
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

  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { agent: { type: "conversation" }, agentSettings: { greetingMessage: "Published greeting" } },
    )
    const memberAuthSubject = `oidc|${randomUUID()}`
    const { addedUser: member } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "member@example.com", authSubject: memberAuthSubject },
      projectMembership: { roleKeys: ["project_member"] },
    })
    // A plain member opens conversations through a role on the agent, as an invitation gives.
    await addUserToAgent({
      repositories,
      agent,
      user: member,
      membership: { roleKeys: ["agent_member"] },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    authSubject = memberAuthSubject
    return { organization, project, agent, agentSettings, member }
  }

  const subject = async (body: unknown = { payload: {} }) =>
    request({
      route: DeskConversationsRoutes.createOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
      body,
    })

  const findMessages = (sessionId: string) =>
    repositories.agentMessageRepository.find({ where: { sessionId } })

  it("creates a live conversation of the caller and returns only its id", async () => {
    const { member } = await createContext()

    const response = await subject()

    expectSchemaResponse(DeskConversationsRoutes.createOne, response, 201)
    expect(response.body.data).toStrictEqual({ id: expect.any(String) })
    const createdSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: response.body.data.id,
    })
    expect(createdSession).toMatchObject({ agentId, userId: member.id, type: "live" })
  })

  it("records conversationAgentSession.create once", async () => {
    const { member } = await createContext()

    expectResponse(await subject(), 201)

    const activities = await repositories.activityRepository.find({
      where: { action: "conversationAgentSession.create" },
    })
    expect(activities).toHaveLength(1)
    expect(activities[0]).toMatchObject({ userId: member.id, organizationId, projectId })
  })

  it("greets with the version in production even when a draft exists", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, greetingMessage: "Draft greeting", isDraft: true }),
    )

    const response = await subject()

    expectResponse(response, 201)
    const messages = await findMessages(response.body.data.id)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      role: "assistant",
      content: "Published greeting",
      status: "completed",
      agentSettingsId: agentSettings.id,
    })
  })

  it("seeds no message when the agent has no greeting", async () => {
    const { agentSettings } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, { greetingMessage: null })

    const response = await subject()

    expectResponse(response, 201)
    expect(await findMessages(response.body.data.id)).toHaveLength(0)
  })

  it("falls back to the version's defaults for the variables its instructions declare", async () => {
    const { agentSettings } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, {
      instructions: "Summarize {{topic}} for {{audience}}",
      variables: { topic: "the product tour", audience: "support agents" },
    })

    const response = await subject()

    expectResponse(response, 201)
    const createdSession = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: response.body.data.id,
    })
    expect(createdSession.variables).toEqual({
      topic: "the product tour",
      audience: "support agents",
    })
  })

  it("refuses the conversation when a declared variable has no value", async () => {
    const { agentSettings } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, {
      instructions: "Summarize {{topic}} for {{audience}}",
      variables: null,
    })

    const response = await subject()

    expectResponse(response, 400, "Missing prompt variables: topic, audience")
    expect(
      await repositories.conversationAgentSessionRepository.count({ where: { agentId } }),
    ).toBe(0)
  })

  it("answers 400 for a settings version, which only the playground chooses", async () => {
    await createContext()

    const response = await subject({ payload: { agentSettingsRevision: 1 } })

    expectResponse(response, 400)
    expect(
      await repositories.conversationAgentSessionRepository.count({ where: { agentId } }),
    ).toBe(0)
  })
})
