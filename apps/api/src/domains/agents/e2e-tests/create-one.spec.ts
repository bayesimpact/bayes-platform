import {
  AgentModel,
  AgentsRoutes,
  DocumentsRagMode,
  EmbeddingModel,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { projectEmbeddingModelFactory } from "@/domains/documents/embeddings/project-embedding-models/project-embedding-model.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectModelFactory } from "@/external/llm/workspace-models/project-model.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentTag } from "../../documents/tags/document-tag.entity"
import { documentTagFactory } from "../../documents/tags/document-tag.factory"
import { Agent } from "../agent.entity"
import { AgentsModule } from "../agents.module"
import { AGENT_DEFAULT_MODELS } from "../settings/agent-models.service"

describe("Agents - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!
    return { organization, project }
  }

  const subject = async (payload?: typeof AgentsRoutes.createOne.request) =>
    request({
      route: AgentsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  const enableModel = async (model: AgentModel) => {
    await repositories.projectModelRepository.save(projectModelFactory.build({ projectId, model }))
  }

  const gemmaAgentPayload: typeof AgentsRoutes.createOne.request = {
    payload: {
      type: "conversation",
      name: "New Agent",
      instructions: "This is a default prompt",
      documentsRagMode: DocumentsRagMode.All,
      model: AgentModel.Gemma4_26B,
      tagsToAdd: [],
      projectAgentSessionCategoryIds: [],
    },
  }

  const vertex3AgentPayload = (
    providerOptions?: Record<string, unknown>,
  ): typeof AgentsRoutes.createOne.request => ({
    payload: {
      ...gemmaAgentPayload.payload,
      model: AgentModel.Gemini35Flash,
      ...(providerOptions ? { providerOptions } : {}),
    },
  })
  const storedOptionsOf = async (agentId: string) =>
    (await setup.getRepository(AgentSettings).findOneByOrFail({ agentId })).providerOptions

  it("gives a new agent its project's default embedding model", async () => {
    const { organization, project } = await createContext()
    await repositories.projectEmbeddingModelRepository.save([
      projectEmbeddingModelFactory
        .completed()
        .transient({ organization, project })
        .build({ modelName: EmbeddingModel.GeminiEmbedding001 }),
      projectEmbeddingModelFactory.default().transient({ organization, project }).build(),
    ])

    const response = await subject(vertex3AgentPayload())

    expectResponse(response, 201)
    const agentSettings = await setup
      .getRepository(AgentSettings)
      .findOneByOrFail({ agentId: response.body.data.id })
    expect(agentSettings.embeddingModel).toBe(EmbeddingModel.BgeM3)
  })

  it("stores the model's default options when the agent sets none", async () => {
    await createContext()

    const response = await subject(vertex3AgentPayload())

    expectResponse(response, 201)
    expect(await storedOptionsOf(response.body.data.id)).toEqual({
      temperature: 1,
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "medium", includeThoughts: true } },
      },
    })
  })

  it("stores the options the agent sets", async () => {
    await createContext()

    const response = await subject(
      vertex3AgentPayload({
        temperature: 0.3,
        providerOptions: {
          vertex: { thinkingConfig: { thinkingLevel: "low", includeThoughts: true } },
        },
      }),
    )

    expectResponse(response, 201)
    expect(await storedOptionsOf(response.body.data.id)).toEqual({
      temperature: 0.3,
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "low", includeThoughts: true } },
      },
    })
  })

  it("rejects options that do not fit the model", async () => {
    await createContext()

    expectResponse(await subject(vertex3AgentPayload({ temperature: 5 })), 400)
  })

  it("rejects a model the workspace has not enabled", async () => {
    await createContext()

    expectResponse(await subject(gemmaAgentPayload), 400)
  })

  it("rejects a model past its deprecation date", async () => {
    await createContext()

    // Gemini 2.5 was deprecated on 2026-09-30.
    expectResponse(
      await subject({ payload: { ...gemmaAgentPayload.payload, model: AgentModel.Gemini25Flash } }),
      400,
    )
  })

  it("accepts a model once the workspace has it enabled", async () => {
    await createContext()
    await enableModel(AgentModel.Gemma4_26B)

    expectResponse(await subject(gemmaAgentPayload), 201)
  })

  it("should create an agent and return it", async () => {
    await createContext()

    const response = await subject({
      payload: {
        type: "conversation",
        name: "New Agent",
        instructions: "This is a default prompt",
        documentsRagMode: DocumentsRagMode.All,
        model: AgentModel.Gemini31FlashLite,
        tagsToAdd: [],
        projectAgentSessionCategoryIds: [],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.name).toBe("New Agent")
    expect(response.body.data.type).toBe("conversation")
    expect(response.body.data.projectId).toBe(projectId)
    expect(response.body.data.id).toBeDefined()
    expect(response.body.data.currentRevision).toBeUndefined()
    expect(response.body.data.draftRevision?.number).toBe(1)

    const agentRepository = setup.getRepository(Agent)
    const agent = await agentRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(agent).not.toBeNull()
    expect(agent?.name).toBe("New Agent")

    // The settings values live on the revision, not on the agent DTO.
    const agentSettings = await setup.getRepository(AgentSettings).findOne({
      where: { agentId: response.body.data.id, revision: 1 },
    })
    expect(agentSettings?.instructions).toBe("This is a default prompt")
    expect(agentSettings?.model).toBe(AgentModel.Gemini31FlashLite)
    expect(agentSettings?.documentsRagMode).toBe(DocumentsRagMode.All)
    await expectActivityCreated("agent.create")
  })

  it("creates the agent as a draft that nothing runs until a version is published", async () => {
    await createContext()

    const response = await subject({ payload: { type: "conversation", name: "Fresh Agent" } })
    expectResponse(response, 201)

    const agentSettings = await setup.getRepository(AgentSettings).findOne({
      where: { agentId: response.body.data.id, revision: 1 },
    })
    expect(agentSettings?.isDraft).toBe(true)

    // The studio lists the draft, as it lists a fresh copy.
    const listWithDraftsResponse = await request({
      route: AgentsRoutes.getAllWithDrafts,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })
    expectResponse(listWithDraftsResponse, 200)
    expect(listWithDraftsResponse.body.data).toHaveLength(1)
    expect(listWithDraftsResponse.body.data[0]?.currentRevision).toBeUndefined()
    expect(listWithDraftsResponse.body.data[0]?.draftRevision?.number).toBe(1)

    // The agents a conversation can reach are the published ones.
    const listResponse = await request({
      route: AgentsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })
    expectResponse(listResponse, 200)
    expect(listResponse.body.data).toHaveLength(0)
  })

  it("gives a conversation agent created from its name and type the defaults", async () => {
    await createContext()

    const response = await subject({ payload: { type: "conversation", name: "Default Agent" } })
    expectResponse(response, 201)

    const agentSettings = await setup
      .getRepository(AgentSettings)
      .findOneByOrFail({ agentId: response.body.data.id, revision: 1 })
    expect(agentSettings.instructions).toContain("## Purpose")
    expect(agentSettings.instructions).toContain(
      "Always answer in the language of the user's last message.",
    )
    expect(agentSettings.model).toBe(AGENT_DEFAULT_MODELS.agent)
    expect(agentSettings.documentsRagMode).toBe(DocumentsRagMode.All)
    expect(agentSettings.outputJsonSchema).toBeNull()
    expect(agentSettings.fillFormEnabled).toBe(false)
  })

  it("gives an extraction agent created from its name and type an example schema", async () => {
    await createContext()

    const response = await subject({ payload: { type: "extraction", name: "Extraction Agent" } })
    expectResponse(response, 201)

    const agentSettings = await setup
      .getRepository(AgentSettings)
      .findOneByOrFail({ agentId: response.body.data.id, revision: 1 })
    expect(agentSettings.instructions).toContain("Extract structured information")
    expect(agentSettings.outputJsonSchema).toMatchObject({ type: "object" })
  })

  it("keeps the instructions the caller sends", async () => {
    await createContext()

    const response = await subject({
      payload: { type: "conversation", name: "Custom Agent", instructions: "Answer briefly." },
    })
    expectResponse(response, 201)

    const agentSettings = await setup
      .getRepository(AgentSettings)
      .findOneByOrFail({ agentId: response.body.data.id, revision: 1 })
    expect(agentSettings.instructions).toBe("Answer briefly.")
  })

  it("should persist greetingMessage when provided", async () => {
    await createContext()

    const response = await subject({
      payload: {
        type: "conversation",
        name: "Greeter Agent",
        instructions: "This is a default prompt",
        greetingMessage: "Hi! How can I help you today?",
        documentsRagMode: DocumentsRagMode.All,
        model: AgentModel.Gemini31FlashLite,
        tagsToAdd: [],
        projectAgentSessionCategoryIds: [],
      },
    })

    expectResponse(response, 201)

    const agentSettings = await setup.getRepository(AgentSettings).findOne({
      where: { agentId: response.body.data.id, revision: 1 },
    })
    expect(agentSettings?.greetingMessage).toBe("Hi! How can I help you today?")
  })

  it("should default greetingMessage to null when omitted", async () => {
    await createContext()

    const response = await subject({
      payload: {
        type: "conversation",
        name: "Silent Agent",
        instructions: "This is a default prompt",
        documentsRagMode: DocumentsRagMode.All,
        model: AgentModel.Gemini31FlashLite,
        tagsToAdd: [],
        projectAgentSessionCategoryIds: [],
      },
    })

    expectResponse(response, 201)

    const agentSettings = await setup.getRepository(AgentSettings).findOne({
      where: { agentId: response.body.data.id, revision: 1 },
    })
    expect(agentSettings?.greetingMessage).toBeNull()
  })

  it("should create a conversation agent with the fillForm tool enabled", async () => {
    await createContext()

    const response = await subject({
      payload: {
        type: "conversation",
        name: "Form Filling Agent",
        instructions: "This is a default prompt",
        documentsRagMode: DocumentsRagMode.All,
        model: AgentModel.Gemini31FlashLite,
        fillFormEnabled: true,
        outputJsonSchema: {
          type: "object",
          properties: { title: { type: "string" }, summary: { type: "string" } },
        },
        tagsToAdd: [],
        projectAgentSessionCategoryIds: [],
      },
    })

    expectResponse(response, 201)

    const agentSettings = await setup.getRepository(AgentSettings).findOne({
      where: { agentId: response.body.data.id, revision: 1 },
    })
    expect(agentSettings?.fillFormEnabled).toBe(true)
    expect(agentSettings?.outputJsonSchema).toEqual({
      type: "object",
      properties: { title: { type: "string" }, summary: { type: "string" } },
    })
  })

  it("gives a form agent created without a schema the default form and its instructions", async () => {
    await createContext()

    const response = await subject({
      payload: { type: "conversation", name: "Form Filling Agent", fillFormEnabled: true },
    })

    expectResponse(response, 201)

    const agentSettings = await setup
      .getRepository(AgentSettings)
      .findOneByOrFail({ agentId: response.body.data.id, revision: 1 })
    expect(agentSettings.fillFormEnabled).toBe(true)
    expect(agentSettings.instructions).toContain("fill out the form")
    expect(agentSettings.outputJsonSchema).toMatchObject({
      type: "object",
      required: ["country", "language"],
    })
  })

  it("should create a tagged agent when documentsRagMode is tags", async () => {
    const { organization, project } = await createContext()
    const documentTag = documentTagFactory.transient({ organization, project }).build()
    await setup.getRepository(DocumentTag).save(documentTag)

    const response = await subject({
      payload: {
        type: "conversation",
        name: "Tagged Agent",
        instructions: "This is a default prompt",
        documentsRagMode: DocumentsRagMode.Tags,
        model: AgentModel.Gemini31FlashLite,
        tagsToAdd: [documentTag.id],
        projectAgentSessionCategoryIds: [],
      },
    })

    expectResponse(response, 201)

    const agentSettings = await setup.getRepository(AgentSettings).findOne({
      where: { agentId: response.body.data.id, revision: 1 },
    })
    expect(agentSettings?.documentsRagMode).toBe(DocumentsRagMode.Tags)

    const taggedAgent = await setup.getRepository(Agent).findOne({
      where: { id: response.body.data.id },
      relations: ["documentTags"],
    })
    expect(taggedAgent?.documentTags.map((savedTag) => savedTag.id)).toEqual([documentTag.id])
  })

  it("should create an agent with selected project categories", async () => {
    const { project } = await createContext()
    const projectCategory = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Billing",
      }),
    )

    const response = await subject({
      payload: {
        type: "conversation",
        name: "Categorized Agent",
        instructions: "This is a default prompt",
        documentsRagMode: DocumentsRagMode.All,
        model: AgentModel.Gemini31FlashLite,
        tagsToAdd: [],
        projectAgentSessionCategoryIds: [projectCategory.id],
      },
    })

    expectResponse(response, 201)

    const agentSessionCategories = await repositories.agentSessionCategoryRepository.find({
      where: { agentId: response.body.data.id },
    })
    expect(agentSessionCategories).toHaveLength(1)
    expect(agentSessionCategories[0]?.projectAgentSessionCategoryId).toBe(projectCategory.id)
  })
})
