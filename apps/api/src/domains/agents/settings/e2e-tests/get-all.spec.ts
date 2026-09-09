import {
  AgentLocale,
  AgentModel,
  AgentSettingsRoutes,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMcpServerFactory } from "@/domains/mcp-servers/agent-mcp-server.factory"
import { mcpServerFactory } from "@/domains/mcp-servers/mcp-server.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"

describe("Agent Settings - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { organization, project, agent, agentSettings, user }
  }

  const subject = async () =>
    request({
      route: AgentSettingsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
    })

  it("should return revisions for agent", async () => {
    const { organization, project, agent, agentSettings } = await createContext()

    const agentSettingsRev2 = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({
        instructions: "Rev 2",
        revision: 2,
      })
    const agentSettingsRev3 = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({
        instructions: "Rev 3",
        revision: 3,
      })
    await repositories.agentSettingsRepository.save([agentSettingsRev2, agentSettingsRev3])

    const response = await subject()

    expectResponse(response, 200)
    const agentHistory = response.body.data
    expect(agentHistory[0]?.instructions).toBe("Rev 3")
    expect(agentHistory[0]?.revision).toBe(3)
    expect(agentHistory[1]?.instructions).toBe("Rev 2")
    expect(agentHistory[1]?.revision).toBe(2)
    expect(agentHistory[2]?.instructions).toBe(agentSettings.instructions)
    expect(agentHistory[2]?.revision).toBe(1)
  })

  it("should return the draft revision so the history can diff it against the published one", async () => {
    const { organization, project, agent } = await createContext()

    const draftRev2 = agentSettingsFactory.transient({ organization, project, agent }).build({
      instructions: "Rev 2 draft",
      revision: 2,
      isDraft: true,
    })
    await repositories.agentSettingsRepository.save(draftRev2)

    const response = await subject()

    expectResponse(response, 200)
    const agentHistory = response.body.data
    expect(agentHistory).toHaveLength(2)
    expect(agentHistory[0]?.revision).toBe(2)
    expect(agentHistory[0]?.isDraft).toBe(true)
    expect(agentHistory[1]?.revision).toBe(1)
    expect(agentHistory[1]?.isDraft).toBe(false)
  })

  it("should return one item array when agent has only one revision has no agents", async () => {
    const { agentSettings } = await createContext()

    const response = await subject()

    expectResponse(response, 200)
    const agentHistory = response.body.data
    expect(agentHistory).toHaveLength(1)
    expect(agentHistory[0]?.instructions).toBe(agentSettings.instructions)
    expect(agentHistory[0]?.revision).toBe(1)
  })

  it("should return the settings fields of each revision", async () => {
    const { organization, project, agent } = await createContext()

    const revision2 = agentSettingsFactory.transient({ organization, project, agent }).build({
      revision: 2,
      revisionName: "Second",
      revisionDesc: "The second revision",
      instructions: "Rev 2 instructions",
      greetingMessage: "Hello there",
      locale: AgentLocale.FR,
      model: AgentModel.Gemini25Flash,
      temperature: 1.5,
      documentsRagMode: DocumentsRagMode.None,
      fillFormEnabled: true,
      outputJsonSchema: { type: "object", properties: { title: { type: "string" } } },
    })
    await repositories.agentSettingsRepository.save(revision2)
    const storedRevision2 = await repositories.agentSettingsRepository.findOneOrFail({
      where: { id: revision2.id },
    })

    const response = await subject()

    expectResponse(response, 200)
    const [latest] = response.body.data
    expect(latest).toEqual({
      id: revision2.id,
      agentId: agent.id,
      revision: 2,
      name: "Second",
      description: "The second revision",
      instructions: "Rev 2 instructions",
      greetingMessage: "Hello there",
      locale: AgentLocale.FR,
      model: AgentModel.Gemini25Flash,
      temperature: 1.5,
      documentsRagMode: DocumentsRagMode.None,
      fillFormEnabled: true,
      outputJsonSchema: { type: "object", properties: { title: { type: "string" } } },
      isDraft: false,
      isArchived: false,
      hasCategories: false,
      documentTagIds: [],
      resourceLibraryIds: expect.any(Array),
      mcpServers: [],
      projectAgentSessionCategoryIds: [],
      usedProjectAgentSessionCategoryIds: [],
      createdAt: storedRevision2.createdAt.getTime(),
      updatedAt: storedRevision2.updatedAt.getTime(),
      priorityCallsEnabled: false,
    })
  })

  it("should include enabled MCP servers on each revision", async () => {
    const { project, agent } = await createContext()

    const mcpServer = mcpServerFactory.build({ name: "Helpful Tools", projectId: project.id })
    await repositories.mcpServerRepository.save(mcpServer)
    await repositories.agentMcpServerRepository.save(
      agentMcpServerFactory.transient({ agent, mcpServer }).build(),
    )

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data[0]?.mcpServers).toEqual([
      { id: mcpServer.id, name: "Helpful Tools", enabled: true },
    ])
  })

  it("should omit archived revisions from the history", async () => {
    const { organization, project, agent } = await createContext()

    const archivedRevision2 = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2, isArchived: true })
    await repositories.agentSettingsRepository.save(archivedRevision2)

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.map((settings) => settings.revision)).toEqual([1])
  })

  it("should not leak revisions belonging to another agent", async () => {
    const { organization, project } = await createContext()

    const otherAgent = agentFactory
      .transient({ organization, project })
      .build({ name: "Other Agent" })
    await repositories.agentRepository.save(otherAgent)
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent: otherAgent })
        .build({ instructions: "Other agent instructions" }),
    )

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data.map((settings) => settings.agentId)).toEqual([agentId])
  })
})
