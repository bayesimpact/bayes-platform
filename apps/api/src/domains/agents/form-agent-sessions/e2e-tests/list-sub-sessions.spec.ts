import { FormAgentSessionsRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { formAgentSessionFactory } from "../form-agent-session.factory"
import { FormAgentSessionsModule } from "../form-agent-sessions.module"

const PARENT_SESSION_ID = "11111111-1111-1111-1111-111111111111"

describe("FormAgentSessionsRoutes.listSubSessions", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let parentAgentId: string
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [FormAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  // The default agent created by createOrganizationWithAgent is a conversation
  // agent, which is the only type allowed to have sub-agents.
  const createContext = async () => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    parentAgentId = agent.id
    auth0Id = user.auth0Id

    const formChildAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({
        name: "Intake Form",
        type: "form",
        outputJsonSchema: { type: "object", properties: { fullName: { type: "string" } } },
      }),
    )

    await repositories.agentSubAgentRepository.save(
      repositories.agentSubAgentRepository.create({
        parentAgentId: agent.id,
        childAgentId: formChildAgent.id,
        toolName: "collect_intake",
        description: "Collect intake details",
        enabled: true,
      }),
    )

    const subSession = await repositories.formAgentSessionRepository.save(
      formAgentSessionFactory
        .transient({ organization, project, user, agent: formChildAgent })
        .playground()
        .build({
          parentSessionId: PARENT_SESSION_ID,
          result: { fullName: "Helpful Assistant" },
        }),
    )

    return { formChildAgent, subSession }
  }

  const subject = async (agentSessionId: string) =>
    request({
      route: FormAgentSessionsRoutes.listSubSessions,
      pathParams: removeNullish({
        organizationId,
        projectId,
        agentId: parentAgentId,
        agentSessionId,
      }),
      token: "token",
      request: { payload: { type: "playground" } },
    })

  it("returns the form sub-sessions delegated by the parent session", async () => {
    const { formChildAgent, subSession } = await createContext()

    const response = await subject(PARENT_SESSION_ID)

    expectResponse(response, 201)
    const subSessions = response.body.data
    expect(subSessions).toHaveLength(1)
    expect(subSessions[0]).toMatchObject({
      toolName: "collect_intake",
      agentId: formChildAgent.id,
      agentName: "Intake Form",
      outputJsonSchema: { type: "object", properties: { fullName: { type: "string" } } },
    })
    expect(subSessions[0]?.session.id).toBe(subSession.id)
    expect(subSessions[0]?.session.result).toEqual({ fullName: "Helpful Assistant" })
  })

  it("returns an empty list when the parent session has no sub-sessions", async () => {
    await createContext()

    const response = await subject("22222222-2222-2222-2222-222222222222")

    expectResponse(response, 201)
    expect(response.body.data).toHaveLength(0)
  })
})
