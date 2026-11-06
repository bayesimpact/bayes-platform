import {
  type BaseAgentSessionTypeDto,
  ConversationAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
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
import type { Agent } from "@/domains/agents/agent.entity"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addMemberByEmailToProject } from "@/domains/projects/memberships/project-membership.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import type { Project } from "@/domains/projects/project.entity"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ConversationAgentSessionsModule } from "../conversation-agent-sessions.module"

describe("ConversationAgentSessionsRoutes.createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSettingsId: string
  let organization: Organization
  let project: Project
  let agent: Agent
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule, ActivitiesModule],
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

  const createContext = async (role: ProjectRoleKey) => {
    const created = await createOrganizationWithAgent(repositories, {
      agentSettings: { greetingMessage: "Published greeting" },
    })
    organization = created.organization
    project = created.project
    agent = created.agent
    const agentSettings = created.agentSettings
    const { addedUser } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "member@example.com", authSubject: "oidc|member" },
      projectMembership: { roleKeys: [role] },
    })

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSettingsId = agentSettings.id
    authSubject = addedUser.authSubject!
  }

  const subject = async (
    type: BaseAgentSessionTypeDto,
    agentSettingsRevision?: number,
    variables?: Record<string, string>,
  ) =>
    request({
      route: ConversationAgentSessionsRoutes[type].createOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request:
        agentSettingsRevision === undefined && variables === undefined
          ? undefined
          : { payload: { agentSettingsRevision, variables } },
    })

  const seedRevision = async ({
    revision,
    greetingMessage,
    isDraft = false,
    isArchived = false,
  }: {
    revision: number
    greetingMessage: string
    isDraft?: boolean
    isArchived?: boolean
  }) => {
    const settings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision, greetingMessage, isDraft, isArchived })
    await repositories.agentSettingsRepository.save(settings)
    return settings
  }

  const findGreeting = async (sessionId: string) => {
    const messages = await repositories.agentMessageRepository.find({ where: { sessionId } })
    expect(messages).toHaveLength(1)
    return messages[0]
  }

  describe("creating a live session", () => {
    it("should create a live session", async () => {
      await createContext("project_member")

      const response = await subject("live")

      expectResponse(response, 201)
      expect(response.body.data.id).toBeDefined()
      expect(response.body.data.agentId).toBe(agentId)
      expect(response.body.data.type).toBe("live")
      expect(response.body.data.createdAt).toBeDefined()
      expect(response.body.data.updatedAt).toBeDefined()

      const createdSession = await repositories.conversationAgentSessionRepository.findOne({
        where: { id: response.body.data.id },
      })
      expect(createdSession).not.toBeNull()
      await expectActivityCreated("conversationAgentSession.create")
    })
  })
  describe("creating a playground session", () => {
    it("should create a playground session", async () => {
      await createContext("project_owner")

      const response = await subject("playground")

      expectResponse(response, 201)
      expect(response.body.data.id).toBeDefined()
      expect(response.body.data.agentId).toBe(agentId)
      expect(response.body.data.type).toBe("playground")
      expect(response.body.data.createdAt).toBeDefined()
      expect(response.body.data.updatedAt).toBeDefined()

      const createdSession = await repositories.conversationAgentSessionRepository.findOne({
        where: { id: response.body.data.id },
      })
      expect(createdSession).not.toBeNull()
    })
  })

  describe("with a greetingMessage on the agent", () => {
    it("should seed an assistant message when the agent has a greetingMessage", async () => {
      await createContext("project_owner")
      const greeting = "Hi! How can I help you today?"
      await repositories.agentSettingsRepository.update(agentSettingsId, {
        greetingMessage: greeting,
      })

      const response = await subject("live")

      expectResponse(response, 201)
      const sessionId = response.body.data.id
      const messages = await repositories.agentMessageRepository.find({ where: { sessionId } })
      expect(messages).toHaveLength(1)
      expect(messages[0]?.role).toBe("assistant")
      expect(messages[0]?.content).toBe(greeting)
      expect(messages[0]?.status).toBe("completed")
    })

    it("should not seed any message when the agent has no greetingMessage", async () => {
      await createContext("project_owner")
      await repositories.agentSettingsRepository.update(agentSettingsId, { greetingMessage: null })

      const response = await subject("live")

      expectResponse(response, 201)
      const messages = await repositories.agentMessageRepository.find({
        where: { sessionId: response.body.data.id },
      })
      expect(messages).toHaveLength(0)
    })
  })

  describe("greeting with a settings version", () => {
    it("greets a playground session with the draft when no version is requested", async () => {
      await createContext("project_owner")
      const draft = await seedRevision({
        revision: 2,
        greetingMessage: "Draft greeting",
        isDraft: true,
      })

      const response = await subject("playground")

      expectResponse(response, 201)
      const greeting = await findGreeting(response.body.data.id)
      expect(greeting?.content).toBe("Draft greeting")
      expect(greeting?.agentSettingsId).toBe(draft.id)
    })

    it("greets a playground session with the requested version", async () => {
      await createContext("project_owner")
      await seedRevision({ revision: 2, greetingMessage: "Draft greeting", isDraft: true })

      const response = await subject("playground", 1)

      expectResponse(response, 201)
      const greeting = await findGreeting(response.body.data.id)
      expect(greeting?.content).toBe("Published greeting")
      expect(greeting?.agentSettingsId).toBe(agentSettingsId)
    })

    it("greets a live session with the published version even when a draft exists", async () => {
      await createContext("project_member")
      await seedRevision({ revision: 2, greetingMessage: "Draft greeting", isDraft: true })

      const response = await subject("live")

      expectResponse(response, 201)
      const greeting = await findGreeting(response.body.data.id)
      expect(greeting?.content).toBe("Published greeting")
    })

    it("rejects a version on a live session", async () => {
      await createContext("project_member")

      const response = await subject("live", 1)

      expectResponse(
        response,
        403,
        "Choosing a settings version is only available in the playground",
      )
    })

    it("rejects an unknown version", async () => {
      await createContext("project_owner")

      const response = await subject("playground", 42)

      expectResponse(response, 404)
    })

    it("rejects an archived version", async () => {
      await createContext("project_owner")
      await seedRevision({ revision: 2, greetingMessage: "Old greeting", isArchived: true })

      const response = await subject("playground", 2)

      expectResponse(response, 422)
    })
  })

  describe("prompt variables", () => {
    const variableInstructions = "Summarize {{topic}} for {{audience}}"

    const declareVariables = async (variables?: Record<string, string> | null) => {
      await repositories.agentSettingsRepository.update(agentSettingsId, {
        instructions: variableInstructions,
        variables: variables ?? null,
      })
    }

    it("refuses the session when a declared variable has no value", async () => {
      await createContext("project_owner")
      await declareVariables()

      const response = await subject("live")

      expectResponse(response, 400, "Missing prompt variables: topic, audience")
      expect(response.body).toMatchObject({
        code: "MISSING_PROMPT_VARIABLES",
        missing: ["topic", "audience"],
      })
      expect(
        await repositories.conversationAgentSessionRepository.find({
          where: { agentId },
        }),
      ).toHaveLength(0)
    })

    it("falls back to the revision's default when the caller sends no value", async () => {
      await createContext("project_owner")
      await declareVariables({ topic: "the product tour" })

      const response = await subject("live", undefined, { audience: "support agents" })

      expectResponse(response, 201)
      const createdSession = await repositories.conversationAgentSessionRepository.findOne({
        where: { id: response.body.data.id },
      })
      expect(createdSession?.variables).toEqual({
        topic: "the product tour",
        audience: "support agents",
      })
    })

    it("lets the caller's value win over the revision's default", async () => {
      await createContext("project_owner")
      await declareVariables({ topic: "the product tour" })

      const response = await subject("live", undefined, {
        topic: "the refund policy",
        audience: "support agents",
      })

      expectResponse(response, 201)
      const createdSession = await repositories.conversationAgentSessionRepository.findOne({
        where: { id: response.body.data.id },
      })
      expect(createdSession?.variables).toEqual({
        topic: "the refund policy",
        audience: "support agents",
      })
    })

    it("stores the values the caller supplies for every declared variable", async () => {
      await createContext("project_owner")
      await declareVariables()

      const response = await subject("live", undefined, {
        topic: "the new pricing page",
        audience: "support agents",
      })

      expectResponse(response, 201)
      const createdSession = await repositories.conversationAgentSessionRepository.findOne({
        where: { id: response.body.data.id },
      })
      expect(createdSession?.variables).toEqual({
        topic: "the new pricing page",
        audience: "support agents",
      })
    })

    it("treats a blank value as missing", async () => {
      await createContext("project_owner")
      await declareVariables()

      const response = await subject("live", undefined, {
        topic: "   ",
        audience: "support agents",
      })

      expectResponse(response, 400, "Missing prompt variables: topic")
      expect(response.body).toMatchObject({
        code: "MISSING_PROMPT_VARIABLES",
        missing: ["topic"],
      })
    })

    it("treats a blank value as missing, so the revision's default is stored", async () => {
      await createContext("project_owner")
      await declareVariables({ topic: "the product tour" })

      const response = await subject("live", undefined, {
        topic: "   ",
        audience: "support agents",
      })

      expectResponse(response, 201)
      const createdSession = await repositories.conversationAgentSessionRepository.findOne({
        where: { id: response.body.data.id },
      })
      expect(createdSession?.variables).toEqual({
        topic: "the product tour",
        audience: "support agents",
      })
    })

    it("ignores values for variables the instructions do not declare", async () => {
      await createContext("project_owner")
      await declareVariables()

      const response = await subject("live", undefined, {
        topic: "the new pricing page",
        audience: "support agents",
        extra: "dropped",
      })

      expectResponse(response, 201)
      const createdSession = await repositories.conversationAgentSessionRepository.findOne({
        where: { id: response.body.data.id },
      })
      expect(createdSession?.variables).toEqual({
        topic: "the new pricing page",
        audience: "support agents",
      })
    })
  })
})
