import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgentMessage } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk conversations - createMessageFeedback", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentMessageId: string
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
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agentMessage } = await createOrganizationWithAgentMessage({
      repositories,
      params: {
        organizationMembership: { roleKeys: ["org_member"] },
        agentSession: { type: "live" },
      },
      agentType: "conversation",
    })
    organizationId = organization.id
    projectId = project.id
    agentMessageId = agentMessage.id
    authSubject = user.authSubject!
    return { user, agentMessage }
  }

  const subject = async (payload: unknown) =>
    request({
      route: DeskConversationsRoutes.createMessageFeedback,
      pathParams: { organizationId, projectId, agentMessageId },
      token: "token",
      body: { payload },
    })

  const findSavedFeedback = () =>
    repositories.agentMessageFeedbackRepository.findOneByOrFail({ agentMessageId })

  const countFeedbacks = () => repositories.agentMessageFeedbackRepository.count()

  it("saves a thumbs-up with no text", async () => {
    const { user } = await createContext()

    const response = await subject({ rating: "positive" })

    expectSchemaResponse(DeskConversationsRoutes.createMessageFeedback, response, 201)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(await findSavedFeedback()).toMatchObject({
      userId: user.id,
      rating: "positive",
      content: "",
    })
  })

  it("saves a report with its trimmed text", async () => {
    await createContext()

    const response = await subject({ rating: "negative", content: "  Out of date prices  " })

    expectSchemaResponse(DeskConversationsRoutes.createMessageFeedback, response, 201)
    expect(await findSavedFeedback()).toMatchObject({
      rating: "negative",
      content: "Out of date prices",
    })
  })

  it("answers 400 for a report with no text", async () => {
    await createContext()

    expectResponse(await subject({ rating: "negative", content: "   " }), 400)
    expect(await countFeedbacks()).toBe(0)
  })

  // The live route saves a feedback with no rating as a report. The Desk schema requires one.
  it("answers 400 for a feedback with no rating", async () => {
    await createContext()

    expectResponse(await subject({ content: "Persisted feedback" }), 400)
    expect(await countFeedbacks()).toBe(0)
  })

  it("answers 400 for an unknown rating", async () => {
    await createContext()

    expectResponse(await subject({ rating: "neutral", content: "Persisted feedback" }), 400)
    expect(await countFeedbacks()).toBe(0)
  })
})
