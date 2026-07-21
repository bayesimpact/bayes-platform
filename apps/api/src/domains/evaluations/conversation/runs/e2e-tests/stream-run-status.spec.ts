import http from "node:http"
import {
  EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO,
  type EvaluationConversationRunStatusChangedEventPayload,
  EvaluationConversationRunsRoutes,
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationConversationRunStatusStreamService } from "../evaluation-conversation-run-status-stream.service"

describe("EvaluationConversationRuns - streamRunStatus", () => {
  let app: INestApplication<App>
  let baseUrl: string
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  const statusStreamSubject = new Subject<EvaluationConversationRunStatusChangedEventPayload>()

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider(EvaluationConversationRunStatusStreamService)
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
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  const buildEvent = (
    overrides: Partial<EvaluationConversationRunStatusChangedEventPayload> = {},
  ): EvaluationConversationRunStatusChangedEventPayload => ({
    type: EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO,
    evaluationConversationRunId: "00000000-0000-0000-0000-000000000001",
    organizationId,
    projectId,
    status: "completed",
    summary: null,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  })

  const streamFirstEvent = (
    emit: () => void,
  ): Promise<EvaluationConversationRunStatusChangedEventPayload> =>
    new Promise((resolve, reject) => {
      const path = EvaluationConversationRunsRoutes.streamRunStatus.getPath({
        organizationId,
        projectId,
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
          ) as EvaluationConversationRunStatusChangedEventPayload
          finish(() => resolve(payload))
        })
      })
      request.on("error", (error) => finish(() => reject(error)))
    })

  it("should stream the status", async () => {
    await createContext()

    const event = buildEvent({
      evaluationConversationRunId: "00000000-0000-0000-0000-000000000011",
      status: "running",
    })
    const received = await streamFirstEvent(() => statusStreamSubject.next(event))

    expect(received.type).toBe(EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO)
    expect(received.evaluationConversationRunId).toBe("00000000-0000-0000-0000-000000000011")
    expect(received.status).toBe("running")
  })

  it("should stream only events of the requested project", async () => {
    await createContext()

    const otherProjectEvent = buildEvent({
      projectId: "00000000-0000-0000-0000-000000000002",
      evaluationConversationRunId: "00000000-0000-0000-0000-000000000012",
    })
    const matchingEvent = buildEvent({
      evaluationConversationRunId: "00000000-0000-0000-0000-000000000021",
    })

    const received = await streamFirstEvent(() => {
      statusStreamSubject.next(otherProjectEvent)
      statusStreamSubject.next(matchingEvent)
    })

    expect(received.evaluationConversationRunId).toBe("00000000-0000-0000-0000-000000000021")
    expect(received.projectId).toBe(projectId)
  })
})
