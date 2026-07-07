import { AgentModel, AgentsRoutes, DocumentsRagMode } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentTag } from "../../documents/tags/document-tag.entity"
import { documentTagFactory } from "../../documents/tags/document-tag.factory"
import { AgentsModule } from "../agents.module"

describe("Agents - updateOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
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
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { organization, project, agent, user }
  }

  const subject = async (payload?: typeof AgentsRoutes.updateOne.request) =>
    request({
      route: AgentsRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: payload,
    })

  it("should update an agent and return success", async () => {
    const { agent } = await createContext()

    const response = await subject({
      payload: {
        ...agent,
        name: "Updated Agent",
        defaultPrompt: "Updated Prompt",
        documentTagIds: [],
        documentsRagMode: DocumentsRagMode.All,
        outputJsonSchema: undefined,
        tagsToAdd: [],
        tagsToRemove: [],
        projectAgentSessionCategoryIds: [],
        greetingMessage: undefined,
      },
    })

    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { success: true } })

    const updatedAgent = await repositories.agentRepository.findOne({
      where: { id: agentId },
    })
    expect(updatedAgent?.name).toBe("Updated Agent")
    expect(updatedAgent?.defaultPrompt).toBe("Updated Prompt")
    expect(updatedAgent?.documentsRagMode).toBe(DocumentsRagMode.All)
    await expectActivityCreated("agent.update")
  })

  it("should update only provided fields (partial update)", async () => {
    const { agent } = await createContext()
    const originalPrompt = agent.defaultPrompt

    const response = await subject({
      payload: {
        ...agent,
        name: "Only Name Updated",
        documentTagIds: [],
        documentsRagMode: DocumentsRagMode.All,
        outputJsonSchema: undefined,
        tagsToAdd: [],
        tagsToRemove: [],
        projectAgentSessionCategoryIds: [],
        greetingMessage: undefined,
      },
    })

    expectResponse(response, 200)

    const updatedAgent = await repositories.agentRepository.findOne({
      where: { id: agentId },
    })
    expect(updatedAgent?.name).toBe("Only Name Updated")
    expect(updatedAgent?.defaultPrompt).toBe(originalPrompt)
  })

  it("should preserve greetingMessage when a partial update omits it", async () => {
    await createContext()

    const setGreeting = await subject({ payload: { greetingMessage: "Hello there!" } })
    expectResponse(setGreeting, 200)
    const afterSet = await repositories.agentRepository.findOne({ where: { id: agentId } })
    expect(afterSet?.greetingMessage).toBe("Hello there!")

    // A different tab saves only its own field and omits greetingMessage entirely.
    const response = await subject({ payload: { name: "Renamed Agent" } })
    expectResponse(response, 200)

    const updatedAgent = await repositories.agentRepository.findOne({ where: { id: agentId } })
    expect(updatedAgent?.name).toBe("Renamed Agent")
    expect(updatedAgent?.greetingMessage).toBe("Hello there!")
  })

  it("should update only the model tab fields and leave the rest untouched", async () => {
    const { agent } = await createContext()

    const response = await subject({
      payload: { model: AgentModel.Gemini25Pro, temperature: 1.5 },
    })
    expectResponse(response, 200)

    const updatedAgent = await repositories.agentRepository.findOne({ where: { id: agentId } })
    expect(updatedAgent?.model).toBe(AgentModel.Gemini25Pro)
    expect(updatedAgent?.temperature).toBe(1.5)
    expect(updatedAgent?.name).toBe(agent.name)
    expect(updatedAgent?.defaultPrompt).toBe(agent.defaultPrompt)
  })

  it("should update and clear greetingMessage", async () => {
    const { agent } = await createContext()

    const setResponse = await subject({
      payload: {
        ...agent,
        greetingMessage: "Hi! How can I help you today?",
        documentTagIds: [],
        documentsRagMode: DocumentsRagMode.All,
        outputJsonSchema: undefined,
        tagsToAdd: [],
        tagsToRemove: [],
        projectAgentSessionCategoryIds: [],
      },
    })
    expectResponse(setResponse, 200)

    const afterSet = await repositories.agentRepository.findOne({ where: { id: agentId } })
    expect(afterSet?.greetingMessage).toBe("Hi! How can I help you today?")

    const clearResponse = await subject({
      payload: {
        ...agent,
        greetingMessage: "",
        documentTagIds: [],
        documentsRagMode: DocumentsRagMode.All,
        outputJsonSchema: undefined,
        tagsToAdd: [],
        tagsToRemove: [],
        projectAgentSessionCategoryIds: [],
      },
    })
    expectResponse(clearResponse, 200)

    const afterClear = await repositories.agentRepository.findOne({ where: { id: agentId } })
    expect(afterClear?.greetingMessage).toBeNull()
  })

  it("should preserve stored tags when switching documentsRagMode to none", async () => {
    const { organization, project, agent } = await createContext()
    const documentTag = documentTagFactory.transient({ organization, project }).build()
    await setup.getRepository(DocumentTag).save(documentTag)
    await repositories.agentRepository.update(agent.id, {
      documentsRagMode: DocumentsRagMode.Tags,
    })
    await repositories.agentRepository
      .createQueryBuilder()
      .relation("documentTags")
      .of(agent.id)
      .add(documentTag.id)

    const response = await subject({
      payload: {
        ...agent,
        documentTagIds: [documentTag.id],
        documentsRagMode: DocumentsRagMode.None,
        outputJsonSchema: undefined,
        tagsToAdd: [],
        tagsToRemove: [],
        projectAgentSessionCategoryIds: [],
        greetingMessage: undefined,
      },
    })

    expectResponse(response, 200)

    const updatedAgent = await repositories.agentRepository.findOne({
      where: { id: agentId },
      relations: ["documentTags"],
    })
    expect(updatedAgent?.documentsRagMode).toBe(DocumentsRagMode.None)
    expect(updatedAgent?.documentTags.map((savedTag) => savedTag.id)).toEqual([documentTag.id])
  })

  it("should update selected project categories", async () => {
    const { project, agent } = await createContext()
    const projectCategory = await repositories.projectAgentSessionCategoryRepository.save(
      repositories.projectAgentSessionCategoryRepository.create({
        projectId: project.id,
        name: "Billing",
      }),
    )

    const response = await subject({
      payload: {
        ...agent,
        documentTagIds: [],
        documentsRagMode: DocumentsRagMode.All,
        outputJsonSchema: undefined,
        tagsToAdd: [],
        tagsToRemove: [],
        projectAgentSessionCategoryIds: [projectCategory.id],
        greetingMessage: undefined,
      },
    })

    expectResponse(response, 200)
    const agentSessionCategories = await repositories.agentSessionCategoryRepository.find({
      where: { agentId },
    })
    expect(agentSessionCategories).toHaveLength(1)
    expect(agentSessionCategories[0]?.projectAgentSessionCategoryId).toBe(projectCategory.id)
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
        ...agent,
        documentTagIds: [],
        documentsRagMode: DocumentsRagMode.All,
        outputJsonSchema: undefined,
        tagsToAdd: [],
        tagsToRemove: [],
        projectAgentSessionCategoryIds: [legacyProjectCategory.id, newProjectCategory.id],
        greetingMessage: undefined,
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

    const response = await subject({
      payload: {
        ...agent,
        documentTagIds: [],
        documentsRagMode: DocumentsRagMode.All,
        outputJsonSchema: undefined,
        tagsToAdd: [],
        tagsToRemove: [],
        projectAgentSessionCategoryIds: [],
        greetingMessage: undefined,
      },
    })

    expectResponse(response, 400)
    const activeCategory = await repositories.agentSessionCategoryRepository.findOne({
      where: { id: agentSessionCategory.id },
    })
    expect(activeCategory).not.toBeNull()
  })
})
