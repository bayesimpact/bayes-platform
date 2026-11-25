import { AgentModel } from "@bayes-platform/api-contracts"
import { DeskExtractionsRoutes } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { documentFactory } from "@/domains/documents/document.factory"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
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

const mockFileStorageService = {
  getTemporaryUrl: jest.fn(),
  save: jest.fn(),
  readFile: jest.fn(),
  deleteFile: jest.fn(),
  generateSignedUploadUrl: jest.fn().mockResolvedValue("https://storage.example.com/upload"),
  buildStorageRelativePath: jest.fn(
    ({ documentId, extension }: { documentId: string; extension: string }) =>
      `org/project/${documentId}.${extension}`,
  ),
}

describe("Desk extractions - deleteMyDocument", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let agentId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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

  let documentId: string

  const saveDocument = async (document: ReturnType<typeof documentFactory.build>) => {
    await repositories.documentRepository.save(document)
    documentId = document.id
    return document
  }

  const subject = async () =>
    request({
      route: DeskExtractionsRoutes.deleteMyDocument,
      pathParams: { organizationId, projectId, agentId, documentId },
      token: "token",
    })

  const isStillThere = async () =>
    (await repositories.documentRepository.findOne({ where: { id: documentId } })) !== null

  it("deletes an extraction document the caller uploaded, with its stored file", async () => {
    const { user, organization, project } = await createContext()
    await saveDocument(
      documentFactory.transient({ organization, project }).build({
        sourceType: "extraction",
        userId: user.id,
        storageRelativePath: "org/project/my-upload.csv",
      }),
    )

    const response = await subject()

    expectSchemaResponse(DeskExtractionsRoutes.deleteMyDocument, response, 201)
    expect(response.body).toEqual({ data: { success: true } })
    expect(await isStillThere()).toBe(false)
    expect(mockFileStorageService.deleteFile).toHaveBeenCalledWith("org/project/my-upload.csv")
    await expectActivityCreated("extractionAgentSession.deleteDocument")
  })

  it("answers 404 for an extraction document a colleague uploaded", async () => {
    const { organization, project } = await createContext()
    const otherUser = await repositories.userRepository.save(userFactory.build())
    await saveDocument(
      documentFactory
        .transient({ organization, project })
        .build({ sourceType: "extraction", userId: otherUser.id }),
    )

    expectResponse(await subject(), 404)
    expect(await isStillThere()).toBe(true)
  })

  it("answers 404 for a knowledge-base document, even one the caller uploaded", async () => {
    const { user, organization, project } = await createContext()
    await saveDocument(
      documentFactory
        .transient({ organization, project })
        .build({ sourceType: "project", userId: user.id }),
    )

    expectResponse(await subject(), 404)
    expect(await isStillThere()).toBe(true)
  })

  it("answers 404 for an extraction document of another project", async () => {
    const { user } = await createContext()
    const { organization: otherOrganization, project: otherProject } =
      await createOrganizationWithProject(repositories)
    await saveDocument(
      documentFactory
        .transient({ organization: otherOrganization, project: otherProject })
        .build({ sourceType: "extraction", userId: user.id }),
    )

    expectResponse(await subject(), 404)
    expect(await isStillThere()).toBe(true)
  })
})
