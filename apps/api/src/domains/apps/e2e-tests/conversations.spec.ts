import { randomUUID } from "node:crypto"
import {
  AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
  AGENT_READ_PERMISSION,
  AppsAgentsRoutes,
  AppsConversationsRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import type { Agent } from "@/domains/agents/agent.entity"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { Project } from "@/domains/projects/project.entity"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { assignPlatformStaffToUser, ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../test/request"
import { AppsModule } from "../apps.module"
import { AppsService } from "../apps.service"
import { INSTALL_PKCE_METHOD_S256, RFC7636_TEST_CODE_CHALLENGE } from "../install-pkce"

const CONVERSATION_PERMISSIONS = [
  AGENT_READ_PERMISSION,
  AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
] as const

describe("Apps - Conversations", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule, RbacModule, ActivitiesModule],
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const installAndIssueToken = async (
    permissions: readonly string[] = CONVERSATION_PERMISSIONS,
  ) => {
    const appsService = setup.module.get(AppsService)
    const { organization, project, agent, user } = await createOrganizationWithAgent(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const slug = `channel-${randomUUID().slice(0, 8)}`
    await appsService.createAppManifest({
      name: "Helpful Assistant",
      slug,
      description: null,
      logoUrl: null,
      grantablePermissions: [...CONVERSATION_PERMISSIONS],
    })
    const credentials = await appsService.authorizeInstall({
      slug,
      userId: user.id,
      projectId: project.id,
      permissions,
      redirectUri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
      codeChallenge: RFC7636_TEST_CODE_CHALLENGE,
      codeChallengeMethod: INSTALL_PKCE_METHOD_S256,
    })
    const token = await appsService.issueToken({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    })
    return {
      organization,
      project,
      agent,
      installationId: credentials.installationId,
      accessToken: token.accessToken,
    }
  }

  const addAgent = async (
    organization: Organization,
    project: Project,
    overrides: Partial<Agent> = {},
  ) => {
    const agent = agentFactory.transient({ organization, project }).build(overrides)
    await repositories.agentRepository.save(agent)
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent }).build(),
    )
    return agent
  }

  const call = (params: {
    method: "get" | "post"
    path: string
    token?: string
    body?: Record<string, unknown>
  }) => {
    const http = request(app.getHttpServer())
    const req = http[params.method](params.path).set("Connection", "close")
    if (params.token) req.set("Authorization", `Bearer ${params.token}`)
    if (params.body) req.send(params.body)
    return req
  }

  const openConversation = (params: {
    projectId: string
    agentId: string
    token: string
    externalUserId?: string
  }) =>
    call({
      method: "post",
      path: AppsConversationsRoutes.createOne.getPath({
        projectId: params.projectId,
        agentId: params.agentId,
      }),
      token: params.token,
      body: { external_user_id: params.externalUserId ?? "hashed-sender-1" },
    })

  const sendMessage = (params: {
    projectId: string
    agentId: string
    conversationId: string
    token: string
    content?: string
  }) =>
    call({
      method: "post",
      path: AppsConversationsRoutes.sendMessage.getPath({
        projectId: params.projectId,
        agentId: params.agentId,
        conversationId: params.conversationId,
      }),
      token: params.token,
      body: { content: params.content ?? "Hello" },
    })

  it("lists the conversation agents of the installed project only", async () => {
    const { organization, project, agent, accessToken } = await installAndIssueToken()
    const second = await addAgent(organization, project, { name: "Support Assistant" })
    await addAgent(organization, project, { name: "Invoice Reader", type: "extraction" })
    const { agent: otherProjectAgent } = await createOrganizationWithAgent(repositories)

    const listed = await call({
      method: "get",
      path: AppsAgentsRoutes.getAll.getPath({ projectId: project.id }),
      token: accessToken,
    })

    expectResponse(listed, 200)
    expect(listed.body.data).toEqual([
      { id: agent.id, name: agent.name },
      { id: second.id, name: "Support Assistant" },
    ])
    expect(listed.body.data.map((listedAgent: { id: string }) => listedAgent.id)).not.toContain(
      otherProjectAgent.id,
    )
  })

  it("opens a conversation for an external user and returns the agent's whole reply", async () => {
    const { organization, project, agent, installationId, accessToken } =
      await installAndIssueToken()

    const opened = await openConversation({
      projectId: project.id,
      agentId: agent.id,
      token: accessToken,
      externalUserId: "hashed-sender-42",
    })
    expectResponse(opened, 201)
    expect(opened.body.data).toMatchObject({
      agentId: agent.id,
      externalUserId: "hashed-sender-42",
    })
    await expectActivityCreated("apps.conversation.create", {
      organizationId: organization.id,
      projectId: project.id,
    })

    const conversationId = opened.body.data.id as string
    const stored = await repositories.publicAgentSessionRepository.findOneByOrFail({
      id: conversationId,
    })
    expect(stored.appInstallationId).toBe(installationId)
    expect(stored.embedConfigId).toBeNull()
    expect(stored.sessionTokenHash).toBeNull()
    expect(stored.externalVisitorId).toBe("hashed-sender-42")

    const replied = await sendMessage({
      projectId: project.id,
      agentId: agent.id,
      conversationId,
      token: accessToken,
    })
    expectResponse(replied, 200)
    expect(replied.body.data.content).toBe("Hello, I'm the stream default mock value!")
    expect(typeof replied.body.data.messageId).toBe("string")

    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: conversationId },
      order: { createdAt: "ASC" },
    })
    expect(messages[0]).toMatchObject({ role: "user", content: "Hello" })
    expect(messages.map((message) => message.role)).toContain("assistant")
  })

  it("refuses an App without the conversation permission", async () => {
    const { project, agent, accessToken } = await installAndIssueToken([AGENT_READ_PERMISSION])

    expectResponse(
      await openConversation({ projectId: project.id, agentId: agent.id, token: accessToken }),
      403,
    )
  })

  it("refuses to list agents without agent.read", async () => {
    const { project, accessToken } = await installAndIssueToken([
      AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
    ])

    expectResponse(
      await call({
        method: "get",
        path: AppsAgentsRoutes.getAll.getPath({ projectId: project.id }),
        token: accessToken,
      }),
      403,
    )
  })

  it("refuses an agent of another project", async () => {
    const { project, accessToken } = await installAndIssueToken()
    const { agent: otherProjectAgent } = await createOrganizationWithAgent(repositories)

    expectResponse(
      await openConversation({
        projectId: project.id,
        agentId: otherProjectAgent.id,
        token: accessToken,
      }),
      403,
    )
  })

  it("does not open a conversation with an extraction agent", async () => {
    const { organization, project, accessToken } = await installAndIssueToken()
    const extractionAgent = await addAgent(organization, project, { type: "extraction" })

    expectResponse(
      await openConversation({
        projectId: project.id,
        agentId: extractionAgent.id,
        token: accessToken,
      }),
      404,
    )
  })

  it("does not reach the conversation of another installation", async () => {
    const first = await installAndIssueToken()
    const opened = await openConversation({
      projectId: first.project.id,
      agentId: first.agent.id,
      token: first.accessToken,
    })
    expectResponse(opened, 201)
    const second = await installAndIssueToken()

    expectResponse(
      await sendMessage({
        projectId: second.project.id,
        agentId: second.agent.id,
        conversationId: opened.body.data.id,
        token: second.accessToken,
      }),
      404,
    )
  })

  it("rejects an empty external user id and an empty message", async () => {
    const { project, agent, accessToken } = await installAndIssueToken()

    expectResponse(
      await openConversation({
        projectId: project.id,
        agentId: agent.id,
        token: accessToken,
        externalUserId: " ",
      }),
      400,
    )

    const opened = await openConversation({
      projectId: project.id,
      agentId: agent.id,
      token: accessToken,
    })
    expectResponse(
      await sendMessage({
        projectId: project.id,
        agentId: agent.id,
        conversationId: opened.body.data.id,
        token: accessToken,
        content: "",
      }),
      400,
    )
  })
})
