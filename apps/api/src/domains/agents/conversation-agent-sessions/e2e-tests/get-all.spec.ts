import {
  type BaseAgentSessionTypeDto,
  ConversationAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { inviteUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { conversationAgentSessionFactory } from "../conversation-agent-session.factory"
import { ConversationAgentSessionsModule } from "../conversation-agent-sessions.module"

describe("ConversationAgentSessionsRoutes.getAll", () => {
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
      additionalImports: [ConversationAgentSessionsModule],
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
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const { invitedUser } = await inviteUserToProject({ repositories, organization, project })
    const { invitedUser: anotherUser } = await inviteUserToProject({
      repositories,
      organization,
      project,
      user: {
        email: "another-user@caseai.test",
        auth0Id: "auth0|another-user",
      },
    })

    const oldestAppSession = conversationAgentSessionFactory
      .transient({
        organization,
        project,
        user: invitedUser,
        agent,
      })
      .live()
      .build({
        createdAt: new Date("2024-01-01T10:00:00.000Z"),
      })

    const newestAppSession = conversationAgentSessionFactory
      .transient({
        organization,
        project,
        user: invitedUser,
        agent,
      })
      .live()
      .build({
        createdAt: new Date("2024-01-01T12:00:00.000Z"),
      })

    const playgroundSession = conversationAgentSessionFactory
      .transient({
        organization,
        project,
        user: invitedUser,
        agent,
      })
      .playground()
      .build()

    const anotherUserAppSession = conversationAgentSessionFactory
      .transient({
        organization,
        project,
        user: anotherUser,
        agent,
      })
      .live()
      .build()

    await repositories.conversationAgentSessionRepository.save([
      oldestAppSession,
      newestAppSession,
      playgroundSession,
      anotherUserAppSession,
    ])

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = invitedUser.auth0Id

    return {
      oldestAppSession,
      newestAppSession,
    }
  }

  const subject = async (type: BaseAgentSessionTypeDto) =>
    request({
      route: ConversationAgentSessionsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: { payload: { type } },
    })

  it("should return only live sessions for authenticated user sorted by newest first", async () => {
    const { oldestAppSession, newestAppSession } = await createContext()

    const response = await subject("live")

    expectResponse(response, 201)
    const sessions = response.body.data
    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.id).toBe(newestAppSession.id)
    expect(sessions[1]?.id).toBe(oldestAppSession.id)
    expect(sessions.every((session) => session.type === "live")).toBeTruthy()
    expect(sessions.every((session) => session.agentId === agentId)).toBeTruthy()
  })

  it("should return the fillForm schema of the revision the session's most recent message ran against", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const { invitedUser } = await inviteUserToProject({ repositories, organization, project })

    const agentSettings = agentSettingsFactory.transient({ organization, project, agent }).build({
      fillFormEnabled: true,
      outputJsonSchema: { type: "object", properties: { title: { type: "string" } } },
      revision: 2,
    })
    await repositories.agentSettingsRepository.save(agentSettings)

    const session = conversationAgentSessionFactory
      .transient({ organization, project, user: invitedUser, agent })
      .live()
      .build({ result: { title: "some result" } })
    await repositories.conversationAgentSessionRepository.save(session)

    const message = agentMessageFactory
      .transient({ organization, project, session, agentSettings })
      .build()
    await repositories.agentMessageRepository.save(message)

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = invitedUser.auth0Id

    const response = await subject("live")

    expectResponse(response, 201)
    const returnedSession = response.body.data[0]
    expect(returnedSession?.outputJsonSchema).toEqual(agentSettings.outputJsonSchema)
  })

  it("should return the newest qualifying revision's schema when a session ran under several revisions", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const { invitedUser } = await inviteUserToProject({ repositories, organization, project })

    const olderAgentSettings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({
        fillFormEnabled: true,
        outputJsonSchema: { type: "object", properties: { title: { type: "string" } } },
        revision: 2,
      })
    const newerAgentSettings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({
        fillFormEnabled: true,
        outputJsonSchema: { type: "object", properties: { summary: { type: "string" } } },
        revision: 3,
      })
    await repositories.agentSettingsRepository.save([olderAgentSettings, newerAgentSettings])

    const session = conversationAgentSessionFactory
      .transient({ organization, project, user: invitedUser, agent })
      .live()
      .build({ result: { title: "some result" } })
    await repositories.conversationAgentSessionRepository.save(session)

    const olderMessage = agentMessageFactory
      .transient({ organization, project, session, agentSettings: olderAgentSettings })
      .build({ createdAt: new Date("2024-01-01T10:00:00.000Z") })
    const newerMessage = agentMessageFactory
      .transient({ organization, project, session, agentSettings: newerAgentSettings })
      .build({ createdAt: new Date("2024-01-01T11:00:00.000Z") })
    await repositories.agentMessageRepository.save([olderMessage, newerMessage])

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = invitedUser.auth0Id

    const response = await subject("live")

    expectResponse(response, 201)
    const returnedSession = response.body.data[0]
    expect(returnedSession?.outputJsonSchema).toEqual(newerAgentSettings.outputJsonSchema)
  })

  it("should return no fillForm schema when the session's revision has fillForm disabled", async () => {
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const { invitedUser } = await inviteUserToProject({ repositories, organization, project })

    const agentSettings = agentSettingsFactory.transient({ organization, project, agent }).build({
      fillFormEnabled: false,
      outputJsonSchema: { type: "object", properties: { title: { type: "string" } } },
      revision: 2,
    })
    await repositories.agentSettingsRepository.save(agentSettings)

    const session = conversationAgentSessionFactory
      .transient({ organization, project, user: invitedUser, agent })
      .live()
      .build({ result: { title: "some result" } })
    await repositories.conversationAgentSessionRepository.save(session)

    const message = agentMessageFactory
      .transient({ organization, project, session, agentSettings })
      .build()
    await repositories.agentMessageRepository.save(message)

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = invitedUser.auth0Id

    const response = await subject("live")

    expectResponse(response, 201)
    const returnedSession = response.body.data[0]
    expect(returnedSession?.outputJsonSchema).toBeUndefined()
  })
})
