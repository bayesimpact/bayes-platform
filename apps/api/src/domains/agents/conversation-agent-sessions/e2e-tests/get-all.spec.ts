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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addMemberByEmailToProject } from "@/domains/projects/memberships/project-membership.factory"
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
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
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
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const { addedUser } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "member@example.com", authSubject: "oidc|member" },
    })
    const { addedUser: anotherUser } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: {
        email: "another-user@caseai.test",
        authSubject: "oidc|another-user",
      },
    })

    const oldestAppSession = conversationAgentSessionFactory
      .transient({
        organization,
        project,
        user: addedUser,
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
        user: addedUser,
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
        user: addedUser,
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
    authSubject = addedUser.authSubject!

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
})
