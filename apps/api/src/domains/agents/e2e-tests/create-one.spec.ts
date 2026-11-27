import { AgentsRoutes, DocumentsRagMode, EmbeddingModel } from "@caseai-connect/api-contracts"
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
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
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

  const subject = async (payload: typeof AgentsRoutes.createOne.request) =>
    request({
      route: AgentsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  const settingsOf = async (agentId: string) =>
    setup.getRepository(AgentSettings).findOneByOrFail({ agentId, revision: 1 })

  it("creates an agent from its name and type and returns it with its draft", async () => {
    await createContext()

    const response = await subject({ payload: { type: "conversation", name: "New Agent" } })

    expectResponse(response, 201)
    expect(response.body.data.name).toBe("New Agent")
    expect(response.body.data.type).toBe("conversation")
    expect(response.body.data.projectId).toBe(projectId)
    expect(response.body.data.currentRevision).toBeUndefined()
    expect(response.body.data.draftRevision?.number).toBe(1)

    const agent = await setup.getRepository(Agent).findOneBy({ id: response.body.data.id })
    expect(agent?.name).toBe("New Agent")
    await expectActivityCreated("agent.create")
  })

  it("creates the agent as a draft that nothing runs until a version is published", async () => {
    await createContext()

    const response = await subject({ payload: { type: "conversation", name: "Fresh Agent" } })
    expectResponse(response, 201)

    const agentSettings = await settingsOf(response.body.data.id)
    expect(agentSettings.isDraft).toBe(true)
    expect(agentSettings.isProduction).toBe(false)

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

  it("gives a conversation agent the default settings", async () => {
    await createContext()

    const response = await subject({ payload: { type: "conversation", name: "Default Agent" } })
    expectResponse(response, 201)

    const agentSettings = await settingsOf(response.body.data.id)
    expect(agentSettings.instructions).toContain("## Purpose")
    expect(agentSettings.instructions).toContain(
      "Always answer in the language of the user's last message.",
    )
    expect(agentSettings.model).toBe(AGENT_DEFAULT_MODELS.agent)
    expect(agentSettings.providerOptions).not.toEqual({})
    expect(agentSettings.documentsRagMode).toBe(DocumentsRagMode.All)
    expect(agentSettings.outputJsonSchema).toBeNull()
    expect(agentSettings.fillFormEnabled).toBe(false)
    expect(agentSettings.greetingMessage).toBeNull()
  })

  it("gives an extraction agent an example result schema", async () => {
    await createContext()

    const response = await subject({ payload: { type: "extraction", name: "Extraction Agent" } })
    expectResponse(response, 201)
    expect(response.body.data.type).toBe("extraction")

    const agentSettings = await settingsOf(response.body.data.id)
    expect(agentSettings.instructions).toContain("Extract structured information")
    expect(agentSettings.outputJsonSchema).toMatchObject({ type: "object" })
  })

  it("creates a form agent as a conversation agent with the fillForm tool and an example form", async () => {
    await createContext()

    const response = await subject({ payload: { type: "form", name: "Form Filling Agent" } })
    expectResponse(response, 201)
    expect(response.body.data.type).toBe("conversation")

    const agentSettings = await settingsOf(response.body.data.id)
    expect(agentSettings.fillFormEnabled).toBe(true)
    expect(agentSettings.instructions).toContain("fill out the form")
    expect(agentSettings.outputJsonSchema).toMatchObject({
      type: "object",
      required: ["country", "language"],
    })
  })

  it("gives the new agent every session category of the project", async () => {
    const { project } = await createContext()
    const projectCategory = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Billing",
      }),
    )

    const response = await subject({ payload: { type: "conversation", name: "Categorized Agent" } })
    expectResponse(response, 201)

    const agentSessionCategories = await repositories.agentSessionCategoryRepository.find({
      where: { agentId: response.body.data.id },
    })
    expect(agentSessionCategories).toHaveLength(1)
    expect(agentSessionCategories[0]?.projectAgentSessionCategoryId).toBe(projectCategory.id)
  })

  it("gives a new agent its project's default embedding model", async () => {
    const { organization, project } = await createContext()
    await repositories.projectEmbeddingModelRepository.save([
      projectEmbeddingModelFactory
        .completed()
        .transient({ organization, project })
        .build({ modelName: EmbeddingModel.GeminiEmbedding001 }),
      projectEmbeddingModelFactory.default().transient({ organization, project }).build(),
    ])

    const response = await subject({ payload: { type: "conversation", name: "New Agent" } })

    expectResponse(response, 201)
    const agentSettings = await settingsOf(response.body.data.id)
    expect(agentSettings.embeddingModel).toBe(EmbeddingModel.BgeM3)
  })

  it("ignores any setting the caller sends: the API sets them from the type", async () => {
    await createContext()

    // A field the contract does not hold is dropped, so the studio cannot set it.
    const payloadWithInstructions = {
      type: "conversation",
      name: "Custom Agent",
      instructions: "Answer briefly.",
    } as typeof AgentsRoutes.createOne.request.payload
    const response = await subject({ payload: payloadWithInstructions })
    expectResponse(response, 201)

    const agentSettings = await settingsOf(response.body.data.id)
    expect(agentSettings.instructions).toContain("## Purpose")
  })

  it("rejects a type that is not a creation type", async () => {
    await createContext()

    const response = await subject({
      payload: {
        type: "translation",
        name: "Odd Agent",
      } as unknown as typeof AgentsRoutes.createOne.request.payload,
    })

    expectResponse(response, 400)
    expect(await setup.getRepository(Agent).count()).toBe(0)
  })

  it("rejects a name shorter than 3 characters", async () => {
    await createContext()

    expectResponse(await subject({ payload: { type: "conversation", name: "AB" } }), 400)
    expect(await setup.getRepository(Agent).count()).toBe(0)
  })
})
