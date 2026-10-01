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

describe("ExtractionAgentSessions - uploadDocument", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ExtractionAgentSessionsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
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
    authSubject = "oidc|123"
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
    authSubject = user.authSubject!
    return { user, organization, project }
  }

  describe("presignDocument", () => {
    const subject = async (payload: typeof ExtractionAgentSessionsRoutes.presignDocument.request) =>
      request({
        route: ExtractionAgentSessionsRoutes.presignDocument,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken,
        request: payload,
      })

    it("creates a pending extraction document and returns its upload URL", async () => {
      const { user } = await createContext()

      const response = await subject({
        payload: {
          type: "playground",
          file: { fileName: "invoice.pdf", mimeType: MimeTypes.pdf, size: 1234 },
        },
      })

      expectResponse(response, 201)
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

    it("rejects a missing file", async () => {
      await createContext()
      expectResponse(await subject({ payload: { type: "playground" } as never }), 422)
    })

    it("rejects a file type that is not allowed", async () => {
      await createContext()
      const response = await subject({
        payload: {
          type: "playground",
          file: { fileName: "script.sh", mimeType: "application/x-sh" as never, size: 10 },
        },
      })
      expectResponse(response, 422)
      expect(await repositories.documentRepository.count()).toBe(0)
    })
  })

  describe("confirmDocument", () => {
    const subject = async (payload: typeof ExtractionAgentSessionsRoutes.confirmDocument.request) =>
      request({
        route: ExtractionAgentSessionsRoutes.confirmDocument,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken,
        request: payload,
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
    }) => {
      const pending = documentFactory.transient({ organization, project }).build({
        sourceType,
        uploadStatus: "pending",
        userId,
      })
      await repositories.documentRepository.save(pending)
      return pending
    }

    it("marks the user's pending extraction document as uploaded", async () => {
      const { user, organization, project } = await createContext()
      const pending = await savePending({ organization, project, userId: user.id })

      const response = await subject({ payload: { type: "playground", documentId: pending.id } })

      expectResponse(response, 201)
      expect(response.body.data.id).toBe(pending.id)
      expect(response.body.data.sourceType).toBe("extraction")

      const document = await repositories.documentRepository.findOneByOrFail({ id: pending.id })
      expect(document.uploadStatus).toBe("uploaded")
      await expectActivityCreated("extractionAgentSession.uploadDocument")
    })

    it("rejects a missing document ID", async () => {
      await createContext()
      expectResponse(await subject({ payload: { type: "playground" } as never }), 422)
    })

    it("does not confirm a document uploaded by another user", async () => {
      const { organization, project } = await createContext()
      const otherUser = await createSingleUser(repositories.userRepository)
      const pending = await savePending({ organization, project, userId: otherUser.id })

      const response = await subject({ payload: { type: "playground", documentId: pending.id } })

      expectResponse(response, 404)
      const document = await repositories.documentRepository.findOneByOrFail({ id: pending.id })
      expect(document.uploadStatus).toBe("pending")
    })

    it("does not confirm a project document", async () => {
      const { user, organization, project } = await createContext()
      const pending = await savePending({
        organization,
        project,
        userId: user.id,
        sourceType: "project",
      })

      const response = await subject({ payload: { type: "playground", documentId: pending.id } })

      expectResponse(response, 404)
      const document = await repositories.documentRepository.findOneByOrFail({ id: pending.id })
      expect(document.uploadStatus).toBe("pending")
    })
  })
})
