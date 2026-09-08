import { ExtractionAgentSessionsRoutes } from "@caseai-connect/api-contracts"
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
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ExtractionAgentSessionsModule } from "../extraction-agent-sessions.module"

const mockLlmProvider = {
  streamChatResponse: jest.fn(),
  generateStructuredOutput: jest.fn(),
}

const mockFileStorageService = {
  getTemporaryUrl: jest.fn().mockResolvedValue("https://example.com/fake-file.pdf"),
  save: jest.fn(),
  readFile: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

describe("ExtractionAgentSessions - listRuns", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ExtractionAgentSessionsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider("_MockLLMProvider")
          .useValue(mockLlmProvider)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService),
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
    await app.close()
  })

  const createContext = async () => {
    const context = await createOrganizationWithAgentSession({
      repositories,
      agentType: "extraction",
    })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentSessionId = context.agentSession.id
    auth0Id = context.user.auth0Id
    return context
  }

  /** A newer published revision, as `publish` would produce after a settings change. */
  const createSecondRevision = async (
    context: Awaited<ReturnType<typeof createOrganizationWithAgentSession>>,
  ) => {
    const { organization, project, agent } = context
    const secondRevision = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2 })
    await repositories.agentSettingsRepository.save(secondRevision)
  }

  const subjectGetAll = async () =>
    request({
      route: ExtractionAgentSessionsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: { payload: { type: "playground" } },
    })

  const subjectGetOne = async () =>
    request({
      route: ExtractionAgentSessionsRoutes.getOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
      token: accessToken,
      request: { payload: { type: "playground" } },
    })

  it("reports the revision a listed run was executed with", async () => {
    await createSecondRevision(await createContext())

    const response = await subjectGetAll()

    expectResponse(response, 201)
    expect(response.body.data).toHaveLength(1)
    // The run keeps the revision it ran with, not the agent's newest one.
    expect(response.body.data[0]!.agentRevision).toBe(1)
  })

  it("reports the revision a single run was executed with", async () => {
    await createSecondRevision(await createContext())

    const response = await subjectGetOne()

    expectResponse(response, 201)
    expect(response.body.data.id).toBe(agentSessionId)
    expect(response.body.data.agentRevision).toBe(1)
  })
})
