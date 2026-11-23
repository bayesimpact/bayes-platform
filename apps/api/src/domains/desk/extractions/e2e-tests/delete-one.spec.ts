import { AgentModel } from "@caseai-connect/api-contracts"
import { DeskExtractionsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { extractionAgentSessionFactory } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.factory"
import { documentFactory } from "@/domains/documents/document.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk extractions - deleteOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  let agentSessionId: string

  /** A project with an extraction agent and a document the caller uploaded. */
  const createContext = async () => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { type: "extraction" },
        agentSettings: { model: AgentModel._Mock },
      },
    )
    const colleague = await repositories.userRepository.save(userFactory.build())
    const document = await repositories.documentRepository.save(
      documentFactory
        .transient({ organization, project })
        .build({ sourceType: "extraction", userId: user.id, fileName: "invoice.pdf" }),
    )
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    authSubject = user.authSubject!
    const saveRun = async (
      owner: typeof user,
      params: Parameters<typeof extractionAgentSessionFactory.build>[0] = {},
    ) => {
      const run = await repositories.extractionAgentSessionRepository.save(
        extractionAgentSessionFactory
          .transient({ organization, project, agent, agentSettings, document, user: owner })
          .build({ type: "live", ...params }),
      )
      agentSessionId = run.id
      return run
    }
    return { user, colleague, document, saveRun }
  }

  const subject = async () =>
    request({
      route: DeskExtractionsRoutes.deleteOne,
      pathParams: { organizationId, projectId, agentId, agentSessionId },
      token: "token",
    })

  const isStillThere = async () =>
    (await repositories.extractionAgentSessionRepository.findOneBy({ id: agentSessionId })) !== null

  it("deletes a run of the caller", async () => {
    const { user, saveRun } = await createContext()
    await saveRun(user)

    const response = await subject()

    expectSchemaResponse(DeskExtractionsRoutes.deleteOne, response, 201)
    expect(response.body).toEqual({ data: { success: true } })
    expect(await isStillThere()).toBe(false)
  })

  it("answers 404 for a colleague's run and keeps it", async () => {
    const { colleague, saveRun } = await createContext()
    await saveRun(colleague)

    expectResponse(await subject(), 404)
    expect(await isStillThere()).toBe(true)
  })

  it("answers 404 for a playground run and keeps it", async () => {
    const { user, saveRun } = await createContext()
    await saveRun(user, { type: "playground" })

    expectResponse(await subject(), 404)
    expect(await isStillThere()).toBe(true)
  })
})
