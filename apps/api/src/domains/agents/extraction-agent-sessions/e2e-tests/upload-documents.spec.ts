import { AgentModel, ExtractionAgentSessionsRoutes, MimeTypes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { documentFactory } from "@/domains/documents/document.factory"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { createSingleUser } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ExtractionAgentSessionsModule } from "../extraction-agent-sessions.module"

const mockFileStorageService = {
  getTemporaryUrl: jest.fn(),
  save: jest.fn(),
  readFile: jest.fn(),
  generateSignedUploadUrl: jest.fn().mockResolvedValue("https://storage.example.com/upload"),
  buildStorageRelativePath: jest.fn(
    ({ documentId, extension }: { documentId: string; extension: string }) =>
      `org/project/${documentId}.${extension}`,
  ),
}

describe("ExtractionAgentSessions - uploadDocuments", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ExtractionAgentSessionsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories, {
      agent: { type: "extraction" },
      agentSettings: { model: AgentModel._Mock },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { user, organization, project }
  }

  describe("presignDocuments", () => {
    const subject = async (
      payload: typeof ExtractionAgentSessionsRoutes.presignDocuments.request,
    ) =>
      request({
        route: ExtractionAgentSessionsRoutes.presignDocuments,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken,
        request: payload,
      })

    it("creates a pending extraction document per file and returns its upload URL", async () => {
      const { user } = await createContext()

      const response = await subject({
        payload: {
          type: "playground",
          files: [{ fileName: "invoice.pdf", mimeType: MimeTypes.pdf, size: 1234 }],
        },
      })

      expectResponse(response, 201)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]?.uploadUrl).toBe("https://storage.example.com/upload")

      const document = await repositories.documentRepository.findOneByOrFail({
        id: response.body.data[0]?.documentId,
      })
      expect(document.sourceType).toBe("extraction")
      expect(document.uploadStatus).toBe("pending")
      expect(document.userId).toBe(user.id)
      expect(document.projectId).toBe(projectId)
      expect(document.fileName).toBe("invoice.pdf")
    })

    it("rejects an empty file list", async () => {
      await createContext()
      expectResponse(await subject({ payload: { type: "playground", files: [] } }), 422)
    })

    it("rejects a file type that is not allowed", async () => {
      await createContext()
      const response = await subject({
        payload: {
          type: "playground",
          files: [{ fileName: "script.sh", mimeType: "application/x-sh" as never, size: 10 }],
        },
      })
      expectResponse(response, 422)
      expect(await repositories.documentRepository.count()).toBe(0)
    })
  })

  describe("confirmDocuments", () => {
    const subject = async (
      payload: typeof ExtractionAgentSessionsRoutes.confirmDocuments.request,
    ) =>
      request({
        route: ExtractionAgentSessionsRoutes.confirmDocuments,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken,
        request: payload,
      })

    it("marks the user's pending extraction document as uploaded", async () => {
      const { user, organization, project } = await createContext()
      const pending = documentFactory.transient({ organization, project }).build({
        sourceType: "extraction",
        uploadStatus: "pending",
        userId: user.id,
      })
      await repositories.documentRepository.save(pending)

      const response = await subject({
        payload: { type: "playground", documentIds: [pending.id] },
      })

      expectResponse(response, 201)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]?.id).toBe(pending.id)
      expect(response.body.data[0]?.sourceType).toBe("extraction")

      const document = await repositories.documentRepository.findOneByOrFail({ id: pending.id })
      expect(document.uploadStatus).toBe("uploaded")
      await expectActivityCreated("extractionAgentSession.uploadDocuments")
    })

    it("rejects an empty document list", async () => {
      await createContext()
      expectResponse(await subject({ payload: { type: "playground", documentIds: [] } }), 422)
    })

    it("does not confirm a document uploaded by another user", async () => {
      const { organization, project } = await createContext()
      const otherUser = await createSingleUser(repositories.userRepository)
      const pending = documentFactory.transient({ organization, project }).build({
        sourceType: "extraction",
        uploadStatus: "pending",
        userId: otherUser.id,
      })
      await repositories.documentRepository.save(pending)

      const response = await subject({
        payload: { type: "playground", documentIds: [pending.id] },
      })

      expectResponse(response, 404)
      const document = await repositories.documentRepository.findOneByOrFail({ id: pending.id })
      expect(document.uploadStatus).toBe("pending")
    })

    it("does not confirm a project document", async () => {
      const { user, organization, project } = await createContext()
      const pending = documentFactory.transient({ organization, project }).build({
        sourceType: "project",
        uploadStatus: "pending",
        userId: user.id,
      })
      await repositories.documentRepository.save(pending)

      const response = await subject({
        payload: { type: "playground", documentIds: [pending.id] },
      })

      expectResponse(response, 404)
      const document = await repositories.documentRepository.findOneByOrFail({ id: pending.id })
      expect(document.uploadStatus).toBe("pending")
    })
  })
})
