import {
  AgentLocale,
  AgentModel,
  AgentsRoutes,
  DocumentsRagMode,
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentTag } from "../../documents/tags/document-tag.entity"
import { documentTagFactory } from "../../documents/tags/document-tag.factory"
import { Agent } from "../agent.entity"
import { AgentsModule } from "../agents.module"

describe("Agents - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  const subject = async (payload?: typeof AgentsRoutes.createOne.request) =>
    request({
      route: AgentsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("should create an agent and return it", async () => {
    await createContext()

    const response = await subject({
      payload: {
        type: "conversation",
        name: "New Agent",
        defaultPrompt: "This is a default prompt",
        documentsRagMode: DocumentsRagMode.All,
        model: AgentModel.Gemini25Flash,
        temperature: 0,
        locale: AgentLocale.EN,
        tagsToAdd: [],
        projectAgentSessionCategoryIds: [],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.name).toBe("New Agent")
    expect(response.body.data.defaultPrompt).toBe("This is a default prompt")
    expect(response.body.data.model).toBe(AgentModel.Gemini25Flash)
    expect(response.body.data.locale).toBe(AgentLocale.EN)
    expect(response.body.data.documentsRagMode).toBe(DocumentsRagMode.All)
    expect(response.body.data.projectId).toBe(projectId)
    expect(response.body.data.id).toBeDefined()

    const agentRepository = setup.getRepository(Agent)
    const agent = await agentRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(agent).not.toBeNull()
    expect(agent?.name).toBe("New Agent")
    await expectActivityCreated("agent.create")
  })

  it("should persist greetingMessage when provided", async () => {
    await createContext()

    const response = await subject({
      payload: {
        type: "conversation",
        name: "Greeter Agent",
        defaultPrompt: "This is a default prompt",
        greetingMessage: "Hi! How can I help you today?",
        documentsRagMode: DocumentsRagMode.All,
        model: AgentModel.Gemini25Flash,
        temperature: 0,
        locale: AgentLocale.EN,
        tagsToAdd: [],
        projectAgentSessionCategoryIds: [],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.greetingMessage).toBe("Hi! How can I help you today?")

    const agent = await setup.getRepository(Agent).findOne({
      where: { id: response.body.data.id },
    })
    expect(agent?.greetingMessage).toBe("Hi! How can I help you today?")
  })

  it("should default greetingMessage to null when omitted", async () => {
    await createContext()

    const response = await subject({
      payload: {
        type: "conversation",
        name: "Silent Agent",
        defaultPrompt: "This is a default prompt",
        documentsRagMode: DocumentsRagMode.All,
        model: AgentModel.Gemini25Flash,
        temperature: 0,
        locale: AgentLocale.EN,
        tagsToAdd: [],
        projectAgentSessionCategoryIds: [],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.greetingMessage).toBeUndefined()

    const agent = await setup.getRepository(Agent).findOne({
      where: { id: response.body.data.id },
    })
    expect(agent?.greetingMessage).toBeNull()
  })

  it("should create a tagged agent when documentsRagMode is tags", async () => {
    const { organization, project } = await createContext()
    const documentTag = documentTagFactory.transient({ organization, project }).build()
    await setup.getRepository(DocumentTag).save(documentTag)

    const response = await subject({
      payload: {
        type: "conversation",
        name: "Tagged Agent",
        defaultPrompt: "This is a default prompt",
        documentsRagMode: DocumentsRagMode.Tags,
        model: AgentModel.Gemini25Flash,
        temperature: 0,
        locale: AgentLocale.EN,
        tagsToAdd: [documentTag.id],
        projectAgentSessionCategoryIds: [],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.documentsRagMode).toBe(DocumentsRagMode.Tags)
    expect(response.body.data.documentTagIds).toEqual([documentTag.id])
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
        defaultPrompt: "This is a default prompt",
        documentsRagMode: DocumentsRagMode.All,
        model: AgentModel.Gemini25Flash,
        temperature: 0,
        locale: AgentLocale.EN,
        tagsToAdd: [],
        projectAgentSessionCategoryIds: [projectCategory.id],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.projectAgentSessionCategoryIds).toEqual([projectCategory.id])

    const agentSessionCategories = await repositories.agentSessionCategoryRepository.find({
      where: { agentId: response.body.data.id },
    })
    expect(agentSessionCategories).toHaveLength(1)
    expect(agentSessionCategories[0]?.projectAgentSessionCategoryId).toBe(projectCategory.id)
  })
})
