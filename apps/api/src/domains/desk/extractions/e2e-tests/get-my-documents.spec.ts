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
import { documentFactory } from "@/domains/documents/document.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk extractions - getMyDocuments", () => {
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

  // A plain project member: the role the project documents route turns away.
  const createContext = async () => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories, {
      projectMembership: { roleKeys: ["project_member"] },
      agent: { type: "extraction" },
      agentSettings: { model: AgentModel._Mock },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    authSubject = user.authSubject!
    return { user, organization, project }
  }

  const subject = async () =>
    request({
      route: DeskExtractionsRoutes.getMyDocuments,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })

  const titlesOf = (response: { body: { data: { fileName?: string }[] } }) =>
    response.body.data.map((document) => document.fileName)

  it("returns only extraction documents owned by the caller", async () => {
    const { user, organization, project } = await createContext()
    const otherUser = await repositories.userRepository.save(userFactory.build())
    await repositories.documentRepository.save([
      documentFactory
        .transient({ organization, project })
        .build({ fileName: "mine.pdf", sourceType: "extraction", userId: user.id }),
      documentFactory
        .transient({ organization, project })
        .build({ fileName: "colleague.pdf", sourceType: "extraction", userId: otherUser.id }),
      documentFactory
        .transient({ organization, project })
        .build({ fileName: "orphan.pdf", sourceType: "extraction", userId: null }),
      documentFactory
        .transient({ organization, project })
        .build({ fileName: "knowledge.pdf", sourceType: "project", userId: user.id }),
    ])

    const response = await subject()

    expectSchemaResponse(DeskExtractionsRoutes.getMyDocuments, response, 201)
    expect(titlesOf(response)).toEqual(["mine.pdf"])
  })

  it("leaves out the documents of another project", async () => {
    const { user, organization, project } = await createContext()
    const { project: otherProject } = await createOrganizationWithProject(repositories)
    await repositories.documentRepository.save([
      documentFactory
        .transient({ organization, project })
        .build({ fileName: "here.pdf", sourceType: "extraction", userId: user.id }),
      documentFactory
        .transient({ organization, project: otherProject })
        .build({ fileName: "elsewhere.pdf", sourceType: "extraction", userId: user.id }),
    ])

    const response = await subject()

    expectSchemaResponse(DeskExtractionsRoutes.getMyDocuments, response, 201)
    expect(titlesOf(response)).toEqual(["here.pdf"])
  })

  it("leaves out the documents whose upload is still pending", async () => {
    const { user, organization, project } = await createContext()
    await repositories.documentRepository.save([
      documentFactory.transient({ organization, project }).build({
        fileName: "done.pdf",
        sourceType: "extraction",
        userId: user.id,
        uploadStatus: "uploaded",
      }),
      documentFactory.transient({ organization, project }).build({
        fileName: "pending.pdf",
        sourceType: "extraction",
        userId: user.id,
        uploadStatus: "pending",
      }),
    ])

    const response = await subject()

    expectSchemaResponse(DeskExtractionsRoutes.getMyDocuments, response, 201)
    expect(titlesOf(response)).toEqual(["done.pdf"])
  })

  it("sorts the documents newest first", async () => {
    const { user, organization, project } = await createContext()
    await repositories.documentRepository.save([
      documentFactory.transient({ organization, project }).build({
        fileName: "older.pdf",
        sourceType: "extraction",
        userId: user.id,
        createdAt: new Date("2025-01-01T00:00:00Z"),
      }),
      documentFactory.transient({ organization, project }).build({
        fileName: "newer.pdf",
        sourceType: "extraction",
        userId: user.id,
        createdAt: new Date("2025-06-01T00:00:00Z"),
      }),
    ])

    const response = await subject()

    expectSchemaResponse(DeskExtractionsRoutes.getMyDocuments, response, 201)
    expect(titlesOf(response)).toEqual(["newer.pdf", "older.pdf"])
  })

  it("answers an empty list when the caller has no document", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskExtractionsRoutes.getMyDocuments, response, 201)
    expect(response.body.data).toEqual([])
  })
})
