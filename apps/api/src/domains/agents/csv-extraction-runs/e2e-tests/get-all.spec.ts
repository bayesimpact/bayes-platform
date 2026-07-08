import { AgentCsvExtractionRunsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { agentCsvExtractionRunFactory } from "../agent-csv-extraction-run.factory"
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import { createCsvExtractionRun, createCsvExtractionRunContext } from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  const mockBatchService = buildMockBatchService()
  const mockFileStorageService = buildMockFileStorageService()

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [AgentCsvExtractionRunsModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => auth0Id, {
          batchService: mockBatchService,
          fileStorageService: mockFileStorageService,
        }),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const subject = async () =>
    request({
      route: AgentCsvExtractionRunsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
    })

  it("returns an empty list when the agent has no runs", async () => {
    const context = await createCsvExtractionRunContext({ repositories, auth0Id })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    auth0Id = context.user.auth0Id

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })

  it("returns only the runs belonging to the requested agent, newest first", async () => {
    const context = await createCsvExtractionRunContext({ repositories, auth0Id })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    auth0Id = context.user.auth0Id

    const older = await createCsvExtractionRun({ repositories, context, status: "completed" })
    older.createdAt = new Date("2024-01-01T00:00:00Z")
    await repositories.agentCsvExtractionRunRepository.save(older)

    const newer = await createCsvExtractionRun({ repositories, context, status: "pending" })
    newer.createdAt = new Date("2024-06-01T00:00:00Z")
    await repositories.agentCsvExtractionRunRepository.save(newer)

    // A run on a different agent in the same project must not leak in.
    const otherAgent = agentFactory
      .transient({ organization: context.organization, project: context.project })
      .build({ type: "extraction" })
    await repositories.agentRepository.save(otherAgent)
    const otherAgentSettings = agentSettingsFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agent: otherAgent,
      })
      .build()
    await repositories.agentSettingsRepository.save(otherAgentSettings)
    const otherRun = agentCsvExtractionRunFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agent: otherAgent,
        agentSettings: otherAgentSettings,
        csvDocument: context.csvDocument,
      })
      .build()
    await repositories.agentCsvExtractionRunRepository.save(otherRun)

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.map((run) => run.id)).toEqual([newer.id, older.id])
  })
})
