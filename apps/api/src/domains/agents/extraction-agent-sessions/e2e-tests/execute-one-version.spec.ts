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
import type { Agent } from "@/domains/agents/agent.entity"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { documentFactory } from "@/domains/documents/document.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { Project } from "@/domains/projects/project.entity"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"

const mockLlmProvider = {
  streamChatResponse: jest.fn(),
  generateStructuredOutput: jest.fn(),
}

/** Every seeded version needs a schema and instructions, or executeExtraction rejects with 422. */
const outputJsonSchema = {
  type: "object",
  properties: { title: { type: "string" } },
  required: ["title"],
}

describe("ExtractionAgentSessions - executeOne settings version", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let documentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider("LLMProvider")
          .useValue(mockLlmProvider),
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
    jest.clearAllMocks()
    mockLlmProvider.generateStructuredOutput.mockResolvedValue({ title: "Sample" })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  let organization: Organization
  let project: Project
  let agent: Agent

  const createContext = async () => {
    const context = await createOrganizationWithAgent(repositories, {
      agent: { type: "extraction" },
      agentSettings: { outputJsonSchema },
    })
    organization = context.organization
    project = context.project
    agent = context.agent

    const document = documentFactory.transient({ organization, project }).build({
      sourceType: "extraction",
      mimeType: "application/pdf",
      storageRelativePath: "documents/sample.pdf",
    })
    await repositories.documentRepository.save(document)

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    documentId = document.id
    auth0Id = context.user.auth0Id
    return context
  }

  const seedRevision = async ({
    revision,
    isDraft = false,
    isArchived = false,
  }: {
    revision: number
    isDraft?: boolean
    isArchived?: boolean
  }) => {
    const settings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision, isDraft, isArchived, outputJsonSchema })
    await repositories.agentSettingsRepository.save(settings)
    return settings
  }

  const subject = async ({
    type = "playground",
    agentSettingsRevision,
  }: {
    type?: "playground" | "live"
    agentSettingsRevision?: number
  } = {}) =>
    request({
      route: ExtractionAgentSessionsRoutes.executeOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: { payload: { documentId, type, agentSettingsRevision } },
    })

  /** Settings row the run was pinned to, which is what the worker will run. */
  const findRunSettingsId = async (runId: string) => {
    const run = await repositories.extractionAgentSessionRepository.findOne({
      where: { id: runId },
    })
    return run?.agentSettingsId
  }

  it("runs the draft when the playground asks for its revision", async () => {
    await createContext()
    const draft = await seedRevision({ revision: 2, isDraft: true })

    const response = await subject({ agentSettingsRevision: 2 })

    expectResponse(response, 201)
    expect(await findRunSettingsId(response.body.data.runId)).toBe(draft.id)
  })

  it("runs the published revision the playground asks for", async () => {
    // Revision 2 is both published and the newest, so a bare "latest" lookup would also land on
    // it. Asking for revision 1 only proves the explicit-revision codepath if it diverges from
    // that default, which is why revision 2 here is published rather than a draft.
    const { agentSettings } = await createContext()
    await seedRevision({ revision: 2 })

    const response = await subject({ agentSettingsRevision: 1 })

    expectResponse(response, 201)
    expect(await findRunSettingsId(response.body.data.runId)).toBe(agentSettings.id)
  })

  it("defaults a playground run with no revision to the draft", async () => {
    await createContext()
    const draft = await seedRevision({ revision: 2, isDraft: true })

    const response = await subject()

    expectResponse(response, 201)
    expect(await findRunSettingsId(response.body.data.runId)).toBe(draft.id)
  })

  it("returns 404 for a revision the agent does not have", async () => {
    await createContext()

    expectResponse(await subject({ agentSettingsRevision: 9 }), 404)
  })

  it("returns 422 for an archived revision", async () => {
    await createContext()
    await seedRevision({ revision: 2, isArchived: true })

    expectResponse(await subject({ agentSettingsRevision: 2 }), 422)
  })

  it("returns 403 when a live run asks for a revision", async () => {
    await createContext()
    await seedRevision({ revision: 2, isDraft: true })

    expectResponse(await subject({ type: "live", agentSettingsRevision: 2 }), 403)
  })

  it("keeps a live run with no revision on the published version", async () => {
    const { agentSettings } = await createContext()
    await seedRevision({ revision: 2, isDraft: true })

    const response = await subject({ type: "live" })

    expectResponse(response, 201)
    expect(await findRunSettingsId(response.body.data.runId)).toBe(agentSettings.id)
  })

  it("rejects a revision that is not an integer", async () => {
    // The revision reaches TypeORM as-is, so anything else must be turned away here rather than
    // surface as a driver error.
    await createContext()

    const response = await request({
      route: ExtractionAgentSessionsRoutes.executeOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: {
        payload: { documentId, type: "playground", agentSettingsRevision: "2" },
      } as unknown as typeof ExtractionAgentSessionsRoutes.executeOne.request,
    })

    expectResponse(response, 403)
  })

  it("rejects a revision outside the Postgres integer range", async () => {
    // `agent_settings.revision` is a Postgres `integer`; anything past its 32-bit signed range
    // must be turned away here rather than surface as a driver range error.
    await createContext()

    const response = await subject({ agentSettingsRevision: 9999999999 })

    expectResponse(response, 403)
  })
})
