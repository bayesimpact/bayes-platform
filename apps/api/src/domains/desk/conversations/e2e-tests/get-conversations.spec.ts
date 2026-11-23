import { randomUUID } from "node:crypto"
import { DeskAgentSessionsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import { conversationFormFactory } from "@/domains/agents/shared/conversation-forms/conversation-form.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addMemberByEmailToProject } from "@/domains/projects/memberships/project-membership.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

const FORM_SCHEMA = {
  type: "object",
  properties: {
    firstName: { type: "string", description: "The first name" },
    lastName: { type: "string" },
  },
  propertyOrdering: ["firstName", "lastName"],
}

describe("Desk conversations - getConversations", () => {
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
      {
        agent: { name: "Helpful Assistant", type: "conversation" },
        agentSettings: { fillFormEnabled: true, outputJsonSchema: FORM_SCHEMA },
      },
    )
    const memberAuthSubject = `oidc|${randomUUID()}`
    const { addedUser: member } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "member@example.com", authSubject: memberAuthSubject },
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

  const subject = async () =>
    request({
      route: DeskAgentSessionsRoutes.getConversations,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })

  it("returns only the caller's live conversations, newest first, with only the fields of the contract", async () => {
    const { organization, project, agent, member } = await createContext()
    const { addedUser: anotherUser } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "another-user@example.com", authSubject: `oidc|${randomUUID()}` },
    })
    const buildSession = conversationAgentSessionFactory.transient({
      organization,
      project,
      agent,
      user: member,
    })
    const [oldestSession, newestSession] =
      await repositories.conversationAgentSessionRepository.save([
        buildSession.live().build({ createdAt: new Date("2024-01-01T10:00:00.000Z") }),
        buildSession
          .live()
          .build({ title: "Pricing", createdAt: new Date("2024-01-01T12:00:00.000Z") }),
        buildSession.playground().build(),
        conversationAgentSessionFactory
          .transient({ organization, project, agent, user: anotherUser })
          .live()
          .build(),
      ])
    if (!oldestSession || !newestSession) throw new Error("sessions not saved")

    const response = await subject()

    expectSchemaResponse(DeskAgentSessionsRoutes.getConversations, response, 201)
    expect(response.body.data).toStrictEqual([
      {
        id: newestSession.id,
        title: "Pricing",
        createdAt: new Date("2024-01-01T12:00:00.000Z").getTime(),
        forms: [],
      },
      {
        id: oldestSession.id,
        createdAt: new Date("2024-01-01T10:00:00.000Z").getTime(),
        forms: [],
      },
    ])
  })

  it("gives each form with the schema of the agent's version in production", async () => {
    const { organization, project, agent, agentSettings, member } = await createContext()
    const session = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user: member })
        .live()
        .build(),
    )
    const updatedAt = new Date("2024-01-02T09:00:00.000Z")
    await repositories.conversationFormRepository.save(
      conversationFormFactory
        .transient({ organization, project, agent, agentSettings, session })
        .build({ state: { firstName: "Ada" }, summary: "A first name", updatedAt }),
    )

    const response = await subject()

    expectSchemaResponse(DeskAgentSessionsRoutes.getConversations, response, 201)
    expect(response.body.data[0]?.forms).toStrictEqual([
      {
        agentId: agent.id,
        agentName: "Helpful Assistant",
        status: "in_progress",
        state: { firstName: "Ada" },
        outputJsonSchema: {
          properties: FORM_SCHEMA.properties,
          propertyOrdering: FORM_SCHEMA.propertyOrdering,
        },
        updatedAt: updatedAt.getTime(),
      },
    ])
  })

  it("leaves out the schema of an agent that no longer fills a form in", async () => {
    const { organization, project, agent, agentSettings, member } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, { fillFormEnabled: false })
    const session = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user: member })
        .live()
        .build(),
    )
    await repositories.conversationFormRepository.save(
      conversationFormFactory
        .transient({ organization, project, agent, agentSettings, session })
        .concluded()
        .build({ state: { firstName: "Ada" } }),
    )

    const response = await subject()

    expectSchemaResponse(DeskAgentSessionsRoutes.getConversations, response, 201)
    const [form] = response.body.data[0]?.forms ?? []
    expect(form?.status).toBe("concluded")
    expect(form).not.toHaveProperty("outputJsonSchema")
  })

  it("returns an empty list when the caller has no conversation", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskAgentSessionsRoutes.getConversations, response, 201)
    expect(response.body.data).toEqual([])
  })
})
