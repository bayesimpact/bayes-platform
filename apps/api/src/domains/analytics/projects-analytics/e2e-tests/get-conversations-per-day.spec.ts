import { randomUUID } from "node:crypto"
import { AnalyticsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsAnalyticsModule } from "../projects-analytics.module"

describe("Projects Analytics - getConversationsPerDay", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let primaryAgentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = `auth0|${randomUUID()}`

  const day1Start = new Date("2026-01-01T00:00:00.000Z")
  const day2Start = new Date("2026-01-02T00:00:00.000Z")
  const day3Start = new Date("2026-01-03T00:00:00.000Z")
  const day3End = new Date(day3Start.getTime() + 24 * 60 * 60 * 1000 - 1)

  const expectedDays = [
    { date: day1Start.toISOString().slice(0, 10), value: 2 },
    { date: day2Start.toISOString().slice(0, 10), value: 1 },
    { date: day3Start.toISOString().slice(0, 10), value: 0 },
  ]

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsAnalyticsModule],
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
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
      projectMembership: { role: "admin" },
    })
    organizationId = organization.id
    projectId = project.id

    const primaryAgent = agentFactory.transient({ organization, project }).build()
    const secondaryAgent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save([primaryAgent, secondaryAgent])
    const primaryAgentSettings = agentSettingsFactory
      .transient({ organization, project, agent: primaryAgent })
      .build()
    const secondaryAgentSettings = agentSettingsFactory
      .transient({ organization, project, agent: secondaryAgent })
      .build()
    await repositories.agentSettingsRepository.save([primaryAgentSettings, secondaryAgentSettings])

    primaryAgentId = primaryAgent.id

    const session1Day1 = conversationAgentSessionFactory
      .transient({ organization, project, agent: primaryAgent, user })
      .build({ createdAt: new Date(day1Start.getTime() + 3600 * 1000), updatedAt: new Date() })
    const session2Day1 = conversationAgentSessionFactory
      .transient({ organization, project, agent: primaryAgent, user })
      .build({ createdAt: new Date(day1Start.getTime() + 2 * 3600 * 1000), updatedAt: new Date() })
    const session3Day2 = conversationAgentSessionFactory
      .transient({ organization, project, agent: primaryAgent, user })
      .build({ createdAt: new Date(day2Start.getTime() + 3600 * 1000), updatedAt: new Date() })
    const session4Day2 = conversationAgentSessionFactory
      .transient({ organization, project, agent: secondaryAgent, user })
      .build({ createdAt: new Date(day2Start.getTime() + 2 * 3600 * 1000), updatedAt: new Date() })

    await repositories.conversationAgentSessionRepository.save([
      session1Day1,
      session2Day1,
      session3Day2,
      session4Day2,
    ])

    await repositories.agentMessageRepository.save([
      agentMessageFactory
        .user()
        .transient({
          organization,
          project,
          session: session1Day1,
          agentSettings: primaryAgentSettings,
        })
        .build({ createdAt: new Date(day1Start.getTime() + 10 * 60 * 1000) }),
      agentMessageFactory
        .user()
        .transient({
          organization,
          project,
          session: session1Day1,
          agentSettings: primaryAgentSettings,
        })
        .build({ createdAt: new Date(day1Start.getTime() + 20 * 60 * 1000) }),
      ...Array.from({ length: 4 }, (_value, messageIndex) =>
        agentMessageFactory
          .user()
          .transient({
            organization,
            project,
            session: session3Day2,
            agentSettings: primaryAgentSettings,
          })
          .build({
            createdAt: new Date(day2Start.getTime() + (messageIndex + 1) * 5 * 60 * 1000),
          }),
      ),
    ])
  }

  const subject = async (agentId?: string) =>
    request({
      route: AnalyticsRoutes.getConversationsPerDay,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      query: removeNullish({
        startAt: String(day1Start.getTime()),
        endAt: String(day3End.getTime()),
        agentId,
      }),
    })

  it("returns conversations per day including zeros", async () => {
    await createContext()
    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data).toEqual([
      { date: day1Start.toISOString().slice(0, 10), value: 2 },
      { date: day2Start.toISOString().slice(0, 10), value: 2 },
      { date: day3Start.toISOString().slice(0, 10), value: 0 },
    ])
  })

  it("can filter conversations per day by agent id", async () => {
    await createContext()
    const response = await subject(primaryAgentId)
    expectResponse(response, 200)
    expect(response.body.data).toEqual(expectedDays)
  })
})
