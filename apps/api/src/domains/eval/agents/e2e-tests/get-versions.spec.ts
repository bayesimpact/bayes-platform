import { AgentModel, DocumentsRagMode, EmbeddingModel } from "@bayes-platform/api-contracts"
import { EvalAgentsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

describe("Evaluation agents - getVersions", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = "oidc|123"
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
    authSubject = user.authSubject!
    return { organization, project, agent, agentSettings }
  }

  const subject = async () =>
    request({
      route: EvalAgentsRoutes.getVersions,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })

  it("returns the versions newest first, with only the fields of the contract", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const revision2 = agentSettingsFactory.transient({ organization, project, agent }).build({
      revision: 2,
      revisionName: "Second",
      revisionDesc: "The second revision",
      instructions: "Rev 2 instructions",
      greetingMessage: "Hello there",
      model: AgentModel.Gemini25Flash,
      documentsRagMode: DocumentsRagMode.None,
      fillFormEnabled: true,
      outputJsonSchema: { type: "object", properties: { title: { type: "string" } } },
      followUpSuggestionsEnabled: true,
      followUpSuggestionsInstructions: "Only when the answer has a difficult term.",
      followUpSuggestionsMax: 3,
    })
    await repositories.agentSettingsRepository.save(revision2)
    const storedRevision2 = await repositories.agentSettingsRepository.findOneOrFail({
      where: { id: revision2.id },
    })

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getVersions, response, 200)
    expect(response.body.data.map((version) => version.revision)).toEqual([2, 1])
    expect(response.body.data[1]?.id).toBe(agentSettings.id)
    expect(response.body.data[0]).toStrictEqual({
      id: revision2.id,
      revision: 2,
      name: "Second",
      description: "The second revision",
      isDraft: false,
      isProduction: false,
      updatedAt: storedRevision2.updatedAt.getTime(),
      instructions: "Rev 2 instructions",
      greetingMessage: "Hello there",
      model: AgentModel.Gemini25Flash,
      providerOptions: {},
      documentsRagMode: DocumentsRagMode.None,
      outputJsonSchema: { type: "object", properties: { title: { type: "string" } } },
      fillFormEnabled: true,
      priorityCallsEnabled: false,
      variables: null,
      embeddingModel: EmbeddingModel.GeminiEmbedding001,
      followUpSuggestionsEnabled: true,
      followUpSuggestionsInstructions: "Only when the answer has a difficult term.",
      followUpSuggestionsMax: 3,
    })
  })

  it("returns the draft and marks the version in production", async () => {
    const { organization, project, agent } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ instructions: "Rev 2 draft", revision: 2, isDraft: true }),
    )

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getVersions, response, 200)
    expect(
      response.body.data.map((version) => [
        version.revision,
        version.isDraft,
        version.isProduction,
      ]),
    ).toEqual([
      [2, true, false],
      [1, false, true],
    ])
  })

  it("leaves out an archived version", async () => {
    const { organization, project, agent } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, isArchived: true }),
    )

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getVersions, response, 200)
    expect(response.body.data.map((version) => version.revision)).toEqual([1])
  })

  it("leaves out the versions of another agent", async () => {
    const { organization, project } = await createContext()
    const otherAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Other Agent" }),
    )
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent: otherAgent })
        .build({ instructions: "Other agent instructions" }),
    )

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getVersions, response, 200)
    expect(response.body.data).toHaveLength(1)
  })
})
