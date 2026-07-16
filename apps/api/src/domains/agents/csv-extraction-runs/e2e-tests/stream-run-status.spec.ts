import http from "node:http"
import {
  AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO,
  type AgentCsvExtractionRunStatusChangedEventPayload,
  AgentCsvExtractionRunsRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import { Subject } from "rxjs"
import type { App } from "supertest/types"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { AgentCsvExtractionRunStatusStreamService } from "../agent-csv-extraction-run-status-stream.service"
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import { createCsvExtractionRunContext } from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns.streamRunStatus", () => {
  let app: INestApplication<App>
  let baseUrl: string
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  const mockBatchService = buildMockBatchService()
  const mockFileStorageService = buildMockFileStorageService()

  const statusStreamSubject = new Subject<AgentCsvExtractionRunStatusChangedEventPayload>()

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [AgentCsvExtractionRunsModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => auth0Id, {
          batchService: mockBatchService,
          fileStorageService: mockFileStorageService,
        })
          .overrideProvider(AgentCsvExtractionRunStatusStreamService)
          .useValue({ events$: statusStreamSubject.asObservable() }),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as http.Server).address()
    const port = typeof address === "object" && address ? address.port : 0
    baseUrl = `http://127.0.0.1:${port}`
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

  const createContext = async () => {
    const context = await createCsvExtractionRunContext({ repositories, auth0Id })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    auth0Id = context.user.auth0Id
    return context
  }

  const buildEvent = (
    overrides: Partial<AgentCsvExtractionRunStatusChangedEventPayload> = {},
  ): AgentCsvExtractionRunStatusChangedEventPayload => ({
    type: AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO,
    agentCsvExtractionRunId: "00000000-0000-0000-0000-000000000001",
    organizationId,
    projectId,
    agentId,
    status: "completed",
    summary: null,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  })

  const streamFirstEvent = (
    emit: () => void,
  ): Promise<AgentCsvExtractionRunStatusChangedEventPayload> =>
    new Promise((resolve, reject) => {
      const path = AgentCsvExtractionRunsRoutes.streamRunStatus.getPath({
        organizationId,
        projectId,
        agentId,
      })
      const headers: Record<string, string> = { Accept: "text/event-stream" }
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`

      let settled = false
      let emitInterval: NodeJS.Timeout | undefined
      let buffer = ""

      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        if (emitInterval) clearInterval(emitInterval)
        clearTimeout(timeout)
        request.destroy()
        fn()
      }

      const timeout = setTimeout(
        () => finish(() => reject(new Error("Timed out waiting for SSE event"))),
        5000,
      )

      const request = http.get(`${baseUrl}${path}`, { headers }, (response) => {
        if (response.statusCode !== 200) {
          finish(() => reject(new Error(`Unexpected status ${response.statusCode}`)))
          return
        }
        response.setEncoding("utf8")
        emit()
        emitInterval = setInterval(emit, 50)

        response.on("data", (chunk: string) => {
          buffer += chunk
          const dataLine = buffer.split("\n").find((line) => line.startsWith("data:"))
          if (!dataLine) return
          const payload = JSON.parse(
            dataLine.slice("data:".length).trim(),
          ) as AgentCsvExtractionRunStatusChangedEventPayload
          finish(() => resolve(payload))
        })
      })
      request.on("error", (error) => finish(() => reject(error)))
    })

  it("should stream the status", async () => {
    await createContext()

    const event = buildEvent({
      agentCsvExtractionRunId: "00000000-0000-0000-0000-000000000011",
      status: "running",
    })
    const received = await streamFirstEvent(() => statusStreamSubject.next(event))

    expect(received.type).toBe(AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO)
    expect(received.agentCsvExtractionRunId).toBe("00000000-0000-0000-0000-000000000011")
    expect(received.agentId).toBe(agentId)
    expect(received.status).toBe("running")
  })

  it("should stream only the status of the specified agent", async () => {
    await createContext()

    const otherAgentEvent = buildEvent({
      agentId: "00000000-0000-0000-0000-000000000002",
      agentCsvExtractionRunId: "00000000-0000-0000-0000-000000000012",
    })
    const matchingEvent = buildEvent({
      agentCsvExtractionRunId: "00000000-0000-0000-0000-000000000021",
    })

    const received = await streamFirstEvent(() => {
      statusStreamSubject.next(otherAgentEvent)
      statusStreamSubject.next(matchingEvent)
    })

    expect(received.agentId).toBe(agentId)
    expect(received.agentCsvExtractionRunId).toBe("00000000-0000-0000-0000-000000000021")
  })
})
