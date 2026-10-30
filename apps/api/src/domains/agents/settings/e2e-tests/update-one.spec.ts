import {
  AgentModel,
  AgentSettingsRoutes,
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
import { projectEmbeddingModelFactory } from "@/domains/documents/embeddings/project-embedding-models/project-embedding-model.factory"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { documentTagFactory } from "@/domains/documents/tags/document-tag.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"

describe("Agent Settings - updateOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
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
    const { user, organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    authSubject = user.authSubject!
    return { organization, project, agent, agentSettings, user }
  }

  const subject = async (payload?: typeof AgentSettingsRoutes.updateOne.request) =>
    request({
      route: AgentSettingsRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: payload,
    })

  const enableFeatureFlag = async (featureFlagKey: string) => {
    await repositories.featureFlagRepository.save(
      repositories.featureFlagRepository.create({ projectId, featureFlagKey, enabled: true }),
    )
  }

  const latestOptions = async () =>
    (
      await repositories.agentSettingsRepository.findOne({
        where: { agentId },
        order: { revision: "DESC" },
      })
    )?.providerOptions

  it("stores the model options checked against the agent's model", async () => {
    const { agentSettings } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, {
      model: AgentModel.Gemini36Flash,
    })

    // Gemini 3.6 takes no temperature: it is dropped, the thinking level is kept.
    expectResponse(
      await subject({
        payload: {
          providerOptions: {
            temperature: 0.3,
            providerOptions: {
              vertex: { thinkingConfig: { thinkingLevel: "high", includeThoughts: true } },
            },
          },
        },
      }),
      200,
    )

    expect(await latestOptions()).toEqual({
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "high", includeThoughts: true } },
      },
    })
  })

  it("rejects options that do not fit the agent's model", async () => {
    const { agentSettings } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, {
      model: AgentModel.Gemini37Flash,
    })

    // Gemini 3.7 does not accept the minimal thinking level.
    expectResponse(
      await subject({
        payload: {
          providerOptions: {
            providerOptions: {
              vertex: { thinkingConfig: { thinkingLevel: "minimal", includeThoughts: true } },
            },
          },
        },
      }),
      400,
    )
  })

  it("starts a new model on its default options when none are sent", async () => {
    await createContext()

    expectResponse(await subject({ payload: { model: AgentModel.Gemini36Flash } }), 200)

    expect(await latestOptions()).toEqual({
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "medium", includeThoughts: true } },
      },
    })
  })

  it("checks the options sent with a new model against that model", async () => {
    await createContext()

    expectResponse(
      await subject({
        payload: {
          model: AgentModel.Gemini35FlashLite,
          providerOptions: {
            providerOptions: {
              vertex: { thinkingConfig: { thinkingLevel: "low", includeThoughts: true } },
            },
          },
        },
      }),
      200,
    )

    expect(await latestOptions()).toEqual({
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "low", includeThoughts: true } },
      },
    })
  })

  it("rejects switching to a model behind a feature flag the project lacks", async () => {
    await createContext()

    expectResponse(await subject({ payload: { model: AgentModel.Gemma4_26B } }), 400)
  })

  it("accepts switching to a flagged provider's model once the project has its flag", async () => {
    await createContext()
    await enableFeatureFlag("gemma")

    expectResponse(await subject({ payload: { model: AgentModel.Gemma4_26B } }), 200)
  })

  it("keeps a model the project lost access to when another field changes", async () => {
    const { agentSettings } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, {
      model: AgentModel.Gemma4_26B,
    })

    expectResponse(
      await subject({
        payload: { model: AgentModel.Gemma4_26B, instructions: "Updated instructions" },
      }),
      200,
    )
  })

  it("rejects switching to a model past its deprecation date", async () => {
    await createContext()

    // Gemini 2.5 was deprecated on 2026-09-30.
    expectResponse(await subject({ payload: { model: AgentModel.Gemini25Pro } }), 400)
  })

  it("keeps a model past its deprecation date when its options change", async () => {
    const { agentSettings } = await createContext()
    await repositories.agentSettingsRepository.update(agentSettings.id, {
      model: AgentModel.Gemini25Flash,
    })

    expectResponse(await subject({ payload: { providerOptions: { temperature: 0.5 } } }), 200)
    expect(await latestOptions()).toEqual({ temperature: 0.5 })
  })

  it("should update the settings in a new draft revision and return success", async () => {
    await createContext()

    const response = await subject({
      payload: {
        instructions: "Updated Prompt",
        documentsRagMode: DocumentsRagMode.All,
      },
    })

    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { success: true } })

    const updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 2 },
    })
    expect(updatedAgentSettings?.instructions).toBe("Updated Prompt")
    expect(updatedAgentSettings?.documentsRagMode).toBe(DocumentsRagMode.All)
    expect(updatedAgentSettings?.isDraft).toBeTruthy()
    await expectActivityCreated("agentSettings.update")
  })

  it("rejects an embedding model the project has not finished embedding with", async () => {
    const { organization, project } = await createContext()
    await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory
        .transient({ organization, project })
        .build({ status: "processing", modelName: EmbeddingModel.BgeM3 }),
    )

    const response = await subject({ payload: { embeddingModel: EmbeddingModel.BgeM3 } })

    expectResponse(
      response,
      422,
      `Embedding model ${EmbeddingModel.BgeM3} is not ready for this project yet`,
    )
  })

  it("accepts an embedding model once the project completed it", async () => {
    const { organization, project } = await createContext()
    await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory.completed().transient({ organization, project }).build(),
    )

    const response = await subject({ payload: { embeddingModel: EmbeddingModel.BgeM3 } })

    expectResponse(response, 200)
    const updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 2 },
    })
    expect(updatedAgentSettings?.embeddingModel).toBe(EmbeddingModel.BgeM3)
  })

  it("accepts a model a new project got from the deployment", async () => {
    await createContext()

    const response = await subject({
      payload: { embeddingModel: EmbeddingModel.GeminiEmbedding001 },
    })

    expectResponse(response, 200)
  })

  it("rejects a Vertex model the project does not embed with", async () => {
    const { organization, project } = await createContext()
    await repositories.projectEmbeddingModelRepository.save(
      projectEmbeddingModelFactory.default().transient({ organization, project }).build(),
    )

    const response = await subject({
      payload: { embeddingModel: EmbeddingModel.GeminiEmbedding001 },
    })

    expectResponse(
      response,
      422,
      `Embedding model ${EmbeddingModel.GeminiEmbedding001} is not ready for this project yet`,
    )
  })

  it("should leave the other fields untouched on a partial update", async () => {
    const { agentSettings } = await createContext()

    const response = await subject({
      payload: { documentsRagMode: agentSettings.documentsRagMode },
    })

    expectResponse(response, 200)

    const publishedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 1 },
    })
    expect(publishedAgentSettings?.instructions).toBe(agentSettings.instructions)
  })

  it("should preserve greetingMessage when a partial update omits it", async () => {
    await createContext()

    const setGreeting = await subject({ payload: { greetingMessage: "Hello there!" } })
    expectResponse(setGreeting, 200)
    const afterSet = await repositories.agentSettingsRepository.findOne({
      where: { agentId },
      order: { revision: "DESC" },
    })
    expect(afterSet?.isDraft).toBeTruthy()
    expect(afterSet?.greetingMessage).toBe("Hello there!")

    // A different tab saves only its own field and omits greetingMessage entirely.
    const response = await subject({ payload: { instructions: "New instructions" } })
    expectResponse(response, 200)

    const updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId },
      order: { revision: "DESC" },
    })
    expect(updatedAgentSettings?.isDraft).toBeTruthy()
    expect(updatedAgentSettings?.instructions).toBe("New instructions")
    expect(updatedAgentSettings?.greetingMessage).toBe("Hello there!")
  })

  it("should update only the model tab fields and leave the rest untouched", async () => {
    const { agent, agentSettings } = await createContext()

    const providerOptions = {
      temperature: 1.5,
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "high", includeThoughts: true } },
      },
    }
    const response = await subject({
      payload: { model: AgentModel.Gemini35Flash, providerOptions },
    })
    expectResponse(response, 200)

    const updatedAgent = await repositories.agentRepository.findOne({ where: { id: agentId } })
    expect(updatedAgent?.name).toBe(agent.name)

    const updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId },
      order: { revision: "DESC" },
    })
    expect(updatedAgentSettings?.model).toBe(AgentModel.Gemini35Flash)
    expect(updatedAgentSettings?.providerOptions).toEqual(providerOptions)
    expect(updatedAgentSettings?.instructions).toBe(agentSettings.instructions)
  })

  it("should enable the fillForm tool and bump the settings revision", async () => {
    await createContext()

    const response = await subject({
      payload: {
        fillFormEnabled: true,
        outputJsonSchema: {
          type: "object",
          properties: { title: { type: "string" }, summary: { type: "string" } },
        },
      },
    })

    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { success: true } })

    const updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId },
      order: { revision: "DESC" },
    })
    expect(updatedAgentSettings?.revision).toBe(2)
    expect(updatedAgentSettings?.fillFormEnabled).toBe(true)
    expect(updatedAgentSettings?.outputJsonSchema).toEqual({
      type: "object",
      properties: { title: { type: "string" }, summary: { type: "string" } },
    })
  })

  it("should reject enabling the fillForm tool when the agent has no outputJsonSchema", async () => {
    await createContext()

    const response = await subject({ payload: { fillFormEnabled: true } })

    expectResponse(response, 422, "outputJsonSchema is required when the fillForm tool is enabled")

    const latestAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId },
      order: { revision: "DESC" },
    })
    expect(latestAgentSettings?.revision).toBe(1)
    expect(latestAgentSettings?.fillFormEnabled).toBe(false)
  })

  it("should update and clear greetingMessage", async () => {
    await createContext()

    const setResponse = await subject({
      payload: { greetingMessage: "Hi! How can I help you today?" },
    })
    expectResponse(setResponse, 200)

    let updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 2 },
    })
    expect(updatedAgentSettings?.isDraft).toBeTruthy()
    expect(updatedAgentSettings?.greetingMessage).toBe("Hi! How can I help you today?")

    const clearResponse = await subject({ payload: { greetingMessage: "" } })
    expectResponse(clearResponse, 200)

    updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 2 },
    })
    expect(updatedAgentSettings?.greetingMessage).toBeNull()
  })

  it("should update and clear variables", async () => {
    await createContext()

    const setResponse = await subject({ payload: { variables: { topic: "the product tour" } } })
    expectResponse(setResponse, 200)

    let updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 2 },
    })
    expect(updatedAgentSettings?.isDraft).toBeTruthy()
    expect(updatedAgentSettings?.variables).toEqual({ topic: "the product tour" })

    const clearResponse = await subject({ payload: { variables: null } })
    expectResponse(clearResponse, 200)

    updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 2 },
    })
    expect(updatedAgentSettings?.variables).toBeNull()
  })

  it("does not start a draft when resending the variables unchanged", async () => {
    await createContext()

    const response = await subject({ payload: { variables: { topic: "the product tour" } } })
    expectResponse(response, 200)

    const resendResponse = await subject({
      payload: { variables: { topic: "the product tour" } },
    })
    expectResponse(resendResponse, 200)

    const revisions = await repositories.agentSettingsRepository.find({ where: { agentId } })
    expect(revisions).toHaveLength(2) // the published revision and the one draft
    expect(revisions.filter((revision) => revision.isDraft)).toHaveLength(1)
  })

  it("should preserve stored tags when switching documentsRagMode to none", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    const documentTag = documentTagFactory.transient({ organization, project }).build()
    await setup.getRepository(DocumentTag).save(documentTag)
    await repositories.agentSettingsRepository.update(agentSettings.id, {
      documentsRagMode: DocumentsRagMode.Tags,
    })
    await repositories.agentRepository
      .createQueryBuilder()
      .relation("documentTags")
      .of(agent.id)
      .add(documentTag.id)

    const response = await subject({
      payload: {
        documentTagIds: [documentTag.id],
        documentsRagMode: DocumentsRagMode.None,
      },
    })

    expectResponse(response, 200)

    const updatedAgent = await repositories.agentRepository.findOne({
      where: { id: agentId },
      relations: ["documentTags"],
    })
    expect(updatedAgent?.documentTags.map((savedTag) => savedTag.id)).toEqual([documentTag.id])
    const updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 2 },
    })
    expect(updatedAgentSettings?.isDraft).toBeTruthy()
    expect(updatedAgentSettings?.documentsRagMode).toBe(DocumentsRagMode.None)
  })

  it("should update selected project categories", async () => {
    const { project } = await createContext()
    const projectCategory = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Billing",
      }),
    )

    const response = await subject({
      payload: { projectAgentSessionCategoryIds: [projectCategory.id] },
    })

    expectResponse(response, 200)
    const agentSessionCategories = await repositories.agentSessionCategoryRepository.find({
      where: { agentId },
    })
    expect(agentSessionCategories).toHaveLength(1)
    expect(agentSessionCategories[0]?.projectAgentSessionCategoryId).toBe(projectCategory.id)
  })

  it("should update priorityCallsEnabled", async () => {
    await createContext()

    const setResponse = await subject({
      payload: { priorityCallsEnabled: true },
    })
    expectResponse(setResponse, 200)

    const updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 2 },
    })
    expect(updatedAgentSettings?.isDraft).toBeTruthy()
    expect(updatedAgentSettings?.priorityCallsEnabled).toBeTruthy()
  })

  it("should preserve an existing soft-deleted project category while adding a new category", async () => {
    const { project, agent } = await createContext()
    const legacyProjectCategory = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Legacy",
      }),
    )
    const newProjectCategory = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "New",
      }),
    )
    await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({
        agentId: agent.id,
        projectAgentSessionCategoryId: legacyProjectCategory.id,
        name: legacyProjectCategory.name,
      }),
    )
    await repositories.projectAgentSessionCategoryRepository.softDelete(legacyProjectCategory.id)

    const response = await subject({
      payload: {
        projectAgentSessionCategoryIds: [legacyProjectCategory.id, newProjectCategory.id],
      },
    })

    expectResponse(response, 200)
    const agentSessionCategories = await repositories.agentSessionCategoryRepository.find({
      where: { agentId },
      order: { name: "ASC" },
    })
    expect(
      agentSessionCategories.map((category) => category.projectAgentSessionCategoryId),
    ).toEqual([legacyProjectCategory.id, newProjectCategory.id])
  })

  it("should update priorityCallsEnabled on any model", async () => {
    await createContext()

    const response = await subject({
      payload: { model: AgentModel.Gemini35Flash, priorityCallsEnabled: true },
    })

    expectResponse(response, 200)
    const updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 2 },
    })
    expect(updatedAgentSettings?.priorityCallsEnabled).toBe(true)
  })

  it("should reject removing a category already used by a conversation", async () => {
    const { organization, project, agent, user } = await createContext()
    const projectCategory = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Billing",
      }),
    )
    const agentSessionCategory = await repositories.agentSessionCategoryRepository.save(
      repositories.agentSessionCategoryRepository.create({
        agentId: agent.id,
        projectAgentSessionCategoryId: projectCategory.id,
        name: projectCategory.name,
      }),
    )
    const session = await repositories.conversationAgentSessionRepository.save(
      repositories.conversationAgentSessionRepository.create({
        organizationId: organization.id,
        projectId: project.id,
        agentId: agent.id,
        userId: user.id,
        type: "playground",
      }),
    )
    await repositories.conversationAgentSessionCategoryRepository.save(
      repositories.conversationAgentSessionCategoryRepository.create({
        conversationAgentSessionId: session.id,
        agentSessionCategoryId: agentSessionCategory.id,
      }),
    )

    const response = await subject({ payload: { projectAgentSessionCategoryIds: [] } })

    expectResponse(response, 400)
    const activeCategory = await repositories.agentSessionCategoryRepository.findOne({
      where: { id: agentSessionCategory.id },
    })
    expect(activeCategory).not.toBeNull()
  })
})
