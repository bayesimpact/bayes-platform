import { randomUUID } from "node:crypto"
import { AgentSubAgentsRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
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
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"

describe("Agents - sub-agents", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories, {
      user: { auth0Id },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { organization, project, agent, user }
  }

  const getAllSubAgents = async () =>
    request({
      route: AgentSubAgentsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: "token",
    })

  const updateAllSubAgents = async (payload: typeof AgentSubAgentsRoutes.updateAll.request) =>
    request({
      route: AgentSubAgentsRoutes.updateAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: "token",
      request: payload,
    })

  it("replaces and returns sub-agents", async () => {
    const { organization, project } = await createContext()
    const childAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({
        name: "Policy Agent",
        type: "conversation",
      }),
    )

    const replaceResponse = await updateAllSubAgents({
      payload: {
        subAgents: [
          {
            childAgentId: childAgent.id,
            toolName: "ask_policy",
            description: "Use for policy questions.",
            enabled: true,
          },
        ],
      },
    })

    expectResponse(replaceResponse, 200)
    expect(replaceResponse.body.data).toHaveLength(1)
    expect(replaceResponse.body.data[0]).toMatchObject({
      parentAgentId: agentId,
      childAgentId: childAgent.id,
      toolName: "ask_policy",
      description: "Use for policy questions.",
      enabled: true,
      childAgent: {
        id: childAgent.id,
        name: "Policy Agent",
        type: "conversation",
      },
    })

    const getResponse = await getAllSubAgents()
    expectResponse(getResponse, 200)
    expect(getResponse.body.data.map((row) => row.childAgentId)).toEqual([childAgent.id])
  })

  it("rejects duplicate sub-agent ids", async () => {
    const { organization, project } = await createContext()
    const childAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )

    const response = await updateAllSubAgents({
      payload: {
        subAgents: [
          {
            childAgentId: childAgent.id,
            toolName: "ask_first",
            description: "",
            enabled: true,
          },
          {
            childAgentId: childAgent.id,
            toolName: "ask_second",
            description: "",
            enabled: true,
          },
        ],
      },
    })

    expectResponse(response, 422)
  })
})
