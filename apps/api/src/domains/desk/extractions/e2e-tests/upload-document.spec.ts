import { AgentModel } from "@caseai-connect/api-contracts"
import { DeskExtractionsRoutes, EXTRACTION_MAX_BYTES } from "@caseai-connect/desk-contracts"
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

describe("Desk extractions - presignDocument and confirmDocument", () => {
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

  describe("presignDocument", () => {
    const subject = async (payload: unknown) =>
      request({
        route: DeskExtractionsRoutes.presignDocument,
        pathParams: { organizationId, projectId, agentId },
        token: "token",
        body: { payload },
      })

    it("creates a pending extraction document and returns its upload URL", async () => {
      const { user } = await createContext()

      const response = await subject({
        file: { fileName: "invoice.pdf", mimeType: "application/pdf", size: 1234 },
      })

      expectSchemaResponse(DeskExtractionsRoutes.presignDocument, response, 201)
      expect(response.body.data.uploadUrl).toBe("https://storage.example.com/upload")

      const document = await repositories.documentRepository.findOneByOrFail({
        id: response.body.data.documentId,
      })
      expect(document.sourceType).toBe("extraction")
      expect(document.uploadStatus).toBe("pending")
      expect(document.userId).toBe(user.id)
      expect(document.projectId).toBe(projectId)
      expect(document.fileName).toBe("invoice.pdf")
    })

    it("answers 400 for a missing file", async () => {
      await createContext()
      expectResponse(await subject({}), 400)
      expect(await repositories.documentRepository.count()).toBe(0)
    })

    it("answers 400 for a file type that is not allowed", async () => {
      await createContext()
      const response = await subject({
        file: { fileName: "script.sh", mimeType: "application/x-sh", size: 10 },
      })
      expectResponse(response, 400)
      expect(await repositories.documentRepository.count()).toBe(0)
    })

    it("answers 400 for a file that is too large", async () => {
      await createContext()
      const response = await subject({
        file: { fileName: "huge.pdf", mimeType: "application/pdf", size: EXTRACTION_MAX_BYTES + 1 },
      })
      expectResponse(response, 400)
      expect(await repositories.documentRepository.count()).toBe(0)
    })
  })

  describe("confirmDocument", () => {
    const subject = async (payload: unknown) =>
      request({
        route: DeskExtractionsRoutes.confirmDocument,
        pathParams: { organizationId, projectId, agentId },
        token: "token",
        body: { payload },
      })

    const savePending = async ({
      organization,
      project,
      userId,
      sourceType = "extraction",
    }: {
      organization: Parameters<typeof documentFactory.transient>[0]["organization"]
      project: Parameters<typeof documentFactory.transient>[0]["project"]
      userId: string
      sourceType?: "extraction" | "project"
    }) =>
      repositories.documentRepository.save(
        documentFactory
          .transient({ organization, project })
          .build({ sourceType, uploadStatus: "pending", userId }),
      )

    it("marks the caller's pending extraction document as uploaded", async () => {
      const { user, organization, project } = await createContext()
      const pending = await savePending({ organization, project, userId: user.id })

      const response = await subject({ documentId: pending.id })

      expectSchemaResponse(DeskExtractionsRoutes.confirmDocument, response, 201)
      expect(response.body.data.id).toBe(pending.id)
      const document = await repositories.documentRepository.findOneByOrFail({ id: pending.id })
      expect(document.uploadStatus).toBe("uploaded")
      await expectActivityCreated("extractionAgentSession.uploadDocument")
    })

    it("answers 400 for a missing document id", async () => {
      await createContext()
      expectResponse(await subject({}), 400)
    })

    it("answers 404 for a document uploaded by another user", async () => {
      const { organization, project } = await createContext()
      const otherUser = await repositories.userRepository.save(userFactory.build())
      const pending = await savePending({ organization, project, userId: otherUser.id })

      expectResponse(await subject({ documentId: pending.id }), 404)
      const document = await repositories.documentRepository.findOneByOrFail({ id: pending.id })
      expect(document.uploadStatus).toBe("pending")
    })

    it("answers 404 for a project document", async () => {
      const { user, organization, project } = await createContext()
      const pending = await savePending({
        organization,
        project,
        userId: user.id,
        sourceType: "project",
      })

      expectResponse(await subject({ documentId: pending.id }), 404)
      const document = await repositories.documentRepository.findOneByOrFail({ id: pending.id })
      expect(document.uploadStatus).toBe("pending")
    })
  })
})
