import http from "node:http"
import {
  EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL_DTO,
  type ExtractionAgentSessionStatusChangedEventPayload,
  ExtractionAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import { Subject } from "rxjs"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { AgentsModule } from "../../agents.module"
import { ExtractionAgentSessionStatusStreamService } from "../extraction-agent-session-status-stream.service"

describe("ExtractionAgentSessionsRoutes.streamSessionStatus", () => {
  let app: INestApplication<App>
  let baseUrl: string
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let userId: string
  let authSubject = "oidc|123"

  const statusStreamSubject = new Subject<ExtractionAgentSessionStatusChangedEventPayload>()

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(ExtractionAgentSessionStatusStreamService)
          .useValue({ events$: statusStreamSubject.asObservable() }),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as http.Server).address()
    const port = typeof address === "object" && address ? address.port : 0
    baseUrl = `http://127.0.0.1:${port}`
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories, {
      agent: { type: "extraction" },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    userId = user.id
    authSubject = user.authSubject!
  }

  const buildEvent = (
    overrides: Partial<ExtractionAgentSessionStatusChangedEventPayload> = {},
  ): ExtractionAgentSessionStatusChangedEventPayload => ({
    type: EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL_DTO,
    extractionAgentSessionId: "00000000-0000-0000-0000-000000000001",
    organizationId,
    projectId,
    agentId,
    runType: "playground",
    userId,
    status: "success",
    updatedAt: 1_700_000_000_000,
    ...overrides,
  })

  const streamFirstEvent = (
    emit: () => void,
  ): Promise<ExtractionAgentSessionStatusChangedEventPayload> =>
    new Promise((resolve, reject) => {
      const path = ExtractionAgentSessionsRoutes.streamSessionStatus.getPath({
        organizationId,
        projectId,
        agentId,
      })
      const headers = { Accept: "text/event-stream", Authorization: "Bearer token" }

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
          ) as ExtractionAgentSessionStatusChangedEventPayload
          finish(() => resolve(payload))
        })
      })
      request.on("error", (error) => finish(() => reject(error)))
    })

  it("streams the status of the caller's playground run", async () => {
    await createContext()

    const event = buildEvent({ extractionAgentSessionId: "00000000-0000-0000-0000-000000000011" })
    const received = await streamFirstEvent(() => statusStreamSubject.next(event))

    expect(received.type).toBe(EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL_DTO)
    expect(received.extractionAgentSessionId).toBe("00000000-0000-0000-0000-000000000011")
    expect(received.status).toBe("success")
  })

  it.each([
    {
      case: "another agent",
      overrides: { agentId: "00000000-0000-0000-0000-000000000002" },
    },
    {
      case: "a colleague, even for a project owner",
      overrides: { userId: "00000000-0000-0000-0000-0000000000aa" },
    },
    {
      case: "the Desk, which is live",
      overrides: { runType: "live" },
    },
  ] as const)("does not stream a run of $case", async ({ overrides }) => {
    await createContext()

    const hiddenEvent = buildEvent({
      ...overrides,
      extractionAgentSessionId: "00000000-0000-0000-0000-000000000012",
    })
    const ownEvent = buildEvent({
      extractionAgentSessionId: "00000000-0000-0000-0000-000000000021",
    })
    const received = await streamFirstEvent(() => {
      statusStreamSubject.next(hiddenEvent)
      statusStreamSubject.next(ownEvent)
    })

    expect(received.extractionAgentSessionId).toBe("00000000-0000-0000-0000-000000000021")
  })
})
