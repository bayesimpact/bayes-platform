import { randomUUID } from "node:crypto"
import {
  AppsDocumentsRoutes,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER,
  DOCUMENT_UPLOAD_MAX_BYTES,
  documentUploadContentLengthRange,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { DOCUMENT_EMBEDDINGS_BATCH_SERVICE } from "@/domains/documents/embeddings/document-embeddings-batch.interface"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { LocalStorageService } from "@/domains/documents/storage/local-storage.service"
import { withDocumentEmbeddingsBatchServiceMock } from "@/domains/documents/test-overrides"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { assignPlatformStaffToUser, ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../test/request"
import { AppsModule } from "../apps.module"
import { AppsService } from "../apps.service"

describe("Apps - Upload document", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let enqueueEmbeddings: jest.Mock

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule, RbacModule],
      applyOverrides: withDocumentEmbeddingsBatchServiceMock,
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    enqueueEmbeddings = setup.module.get(DOCUMENT_EMBEDDINGS_BATCH_SERVICE)
      .enqueueCreateEmbeddingsForDocument as jest.Mock
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    enqueueEmbeddings.mockClear()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const postDocument = (params: {
    projectId: string
    token?: string
    body?: Record<string, unknown>
  }) => {
    const req = request(app.getHttpServer())
      .post(AppsDocumentsRoutes.createOne.getPath({ projectId: params.projectId }))
      .set("Connection", "close")
    if (params.token) req.set("Authorization", `Bearer ${params.token}`)
    if (params.body) req.send(params.body)
    return req
  }

  const confirmDocument = (params: { projectId: string; documentId: string; token?: string }) => {
    const req = request(app.getHttpServer())
      .post(
        AppsDocumentsRoutes.confirmOne.getPath({
          projectId: params.projectId,
          documentId: params.documentId,
        }),
      )
      .set("Connection", "close")
    if (params.token) req.set("Authorization", `Bearer ${params.token}`)
    return req
  }

  const installAndIssueToken = async (permissions: readonly string[]) => {
    const appsService = setup.module.get(AppsService)
    const { project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const slug = `upload-${randomUUID().slice(0, 8)}`
    await appsService.createAppManifest({
      name: "Helpful Assistant",
      slug,
      description: null,
      logoUrl: null,
      grantablePermissions: [DOCUMENT_READ_PERMISSION, DOCUMENT_CREATE_PERMISSION],
    })
    const credentials = await appsService.authorizeInstall({
      slug,
      userId: user.id,
      projectId: project.id,
      permissions,
      redirectUri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
    })
    const token = await appsService.issueToken({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    })
    return { project, user, accessToken: token.accessToken }
  }

  const fileBody = {
    file_name: "notes.pdf",
    mime_type: "application/pdf",
    size: 8,
    source_url: "https://example.com/notes.pdf",
  }

  it("uploads a file in three steps and queues extraction on confirm", async () => {
    const { project, user, accessToken } = await installAndIssueToken([DOCUMENT_CREATE_PERMISSION])
    const created = await postDocument({
      projectId: project.id,
      token: accessToken,
      body: { ...fileBody, title: "Helpful notes" },
    })
    expectResponse(created, 201)
    expect(created.body.data).toMatchObject({
      title: "Helpful notes",
      projectId: project.id,
      sourceUrl: "https://example.com/notes.pdf",
      embeddingStatus: "pending",
      uploadHeaders: {
        "Content-Type": "application/pdf",
        [DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER]: documentUploadContentLengthRange(),
      },
    })
    expect(created.body.data.uploadUrl).toEqual(expect.any(String))
    expect(enqueueEmbeddings).not.toHaveBeenCalled()

    const storedPending = await repositories.documentRepository.findOneByOrFail({
      id: created.body.data.id,
    })
    expect(storedPending).toMatchObject({
      content: null,
      sourceType: "project",
      uploadStatus: "pending",
      mimeType: "application/pdf",
      size: 8,
      fileName: "notes.pdf",
    })

    const missingUpload = await confirmDocument({
      projectId: project.id,
      documentId: created.body.data.id,
      token: accessToken,
    })
    expectResponse(missingUpload, 400, "Upload is missing")

    const bytes = Buffer.from("%PDF-1.4")
    const uploaded = await request(app.getHttpServer())
      .put(localUploadPath(created.body.data.uploadUrl))
      .set("Content-Type", "application/pdf")
      .send(bytes)
    expect(uploaded.status).toBe(200)

    const confirmed = await confirmDocument({
      projectId: project.id,
      documentId: created.body.data.id,
      token: accessToken,
    })
    expectResponse(confirmed, 201)
    expect(confirmed.body.data).toEqual({
      id: created.body.data.id,
      title: "Helpful notes",
      projectId: project.id,
      sourceUrl: "https://example.com/notes.pdf",
      embeddingStatus: "queued",
    })
    expect(confirmed.body.data.uploadUrl).toBeUndefined()

    const stored = await repositories.documentRepository.findOneByOrFail({
      id: created.body.data.id,
    })
    expect(stored.uploadStatus).toBe("uploaded")
    expect(stored.content).toBeNull()
    expect(stored.userId).toEqual(expect.any(String))
    expect(stored.userId).not.toBe(user.id)
    const storage = setup.module.get(FILE_STORAGE_SERVICE)
    await expect(storage.readFile(stored.storageRelativePath)).resolves.toEqual(bytes)
    expect(enqueueEmbeddings).toHaveBeenCalledTimes(1)
    expect(enqueueEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: created.body.data.id,
        organizationId: project.organizationId,
        projectId: project.id,
        uploadedByUserId: stored.userId,
        origin: "document-upload",
      }),
    )

    const again = await confirmDocument({
      projectId: project.id,
      documentId: created.body.data.id,
      token: accessToken,
    })
    expectResponse(again, 400, "Document is not pending")
  })

  it("uses the file name when the title is omitted and creates a new document each time", async () => {
    const { project, accessToken } = await installAndIssueToken([DOCUMENT_CREATE_PERMISSION])
    const first = await postDocument({
      projectId: project.id,
      token: accessToken,
      body: { file_name: "report.pdf", mime_type: "application/pdf", size: 4 },
    })
    const second = await postDocument({
      projectId: project.id,
      token: accessToken,
      body: { file_name: "report.pdf", mime_type: "application/pdf", size: 4 },
    })
    expectResponse(first, 201)
    expectResponse(second, 201)
    expect(first.body.data.title).toBe("report.pdf")
    expect(first.body.data.sourceUrl).toBeNull()
    expect(second.body.data.id).not.toBe(first.body.data.id)
  })

  it("returns 400 when the body mixes content and a file, or the file fields are invalid", async () => {
    const { project, accessToken } = await installAndIssueToken([DOCUMENT_CREATE_PERMISSION])
    const cases: Record<string, unknown>[] = [
      { ...fileBody, content: "The assistant stored this page." },
      { ...fileBody, mime_type: "application/zip" },
      { ...fileBody, size: DOCUMENT_UPLOAD_MAX_BYTES + 1 },
      { ...fileBody, title: " " },
      { ...fileBody, title: "x".repeat(501) },
      { ...fileBody, source_url: "ftp://example.com/notes.pdf" },
      { ...fileBody, source_url: "/notes.pdf" },
    ]
    for (const body of cases) {
      const response = await postDocument({ projectId: project.id, token: accessToken, body })
      expectResponse(response, 400, "Invalid document payload")
    }
    expect(await repositories.documentRepository.count()).toBe(0)
  })

  it("accepts a file at the size cap", async () => {
    const { project, accessToken } = await installAndIssueToken([DOCUMENT_CREATE_PERMISSION])
    const created = await postDocument({
      projectId: project.id,
      token: accessToken,
      body: {
        file_name: "large.pdf",
        mime_type: "application/pdf",
        size: DOCUMENT_UPLOAD_MAX_BYTES,
      },
    })
    expectResponse(created, 201)
    expect(created.body.data.embeddingStatus).toBe("pending")
  })

  it("returns 400 from the upload URL when the body exceeds the cap", async () => {
    const storage = setup.module.get(FILE_STORAGE_SERVICE)
    if (!(storage instanceof LocalStorageService)) {
      throw new Error("Expected local file storage in tests")
    }
    const uploadUrl = await storage.generateSignedUploadUrl({
      storagePath: `upload-cap/${randomUUID()}.pdf`,
      mimeType: "application/pdf",
      expiresInSeconds: 60,
      maxBytes: 4,
    })
    const uploaded = await request(app.getHttpServer())
      .put(localUploadPath(uploadUrl))
      .set("Content-Type", "application/pdf")
      .send(Buffer.from("12345"))
    expectResponse(uploaded, 400, "Upload exceeds the maximum size.")
  })

  it("returns 403 when the path project is not the token project", async () => {
    const { accessToken } = await installAndIssueToken([DOCUMENT_CREATE_PERMISSION])
    const other = await createOrganizationWithProject(repositories)
    const created = await postDocument({
      projectId: other.project.id,
      token: accessToken,
      body: fileBody,
    })
    expect(created.status).toBe(403)
    const confirmed = await confirmDocument({
      projectId: other.project.id,
      documentId: randomUUID(),
      token: accessToken,
    })
    expect(confirmed.status).toBe(403)
  })

  it("returns 403 when the install was not granted document.create", async () => {
    const { project, accessToken } = await installAndIssueToken([DOCUMENT_READ_PERMISSION])
    expectResponse(
      await postDocument({ projectId: project.id, token: accessToken, body: fileBody }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
    expectResponse(
      await confirmDocument({
        projectId: project.id,
        documentId: randomUUID(),
        token: accessToken,
      }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
  })

  it("returns 401 without an App JWT", async () => {
    const { project } = await installAndIssueToken([DOCUMENT_CREATE_PERMISSION])
    expectResponse(
      await postDocument({ projectId: project.id, body: fileBody }),
      401,
      AUTH_ERRORS.NO_ACCESS_TOKEN,
    )
    expectResponse(
      await confirmDocument({ projectId: project.id, documentId: randomUUID() }),
      401,
      AUTH_ERRORS.NO_ACCESS_TOKEN,
    )
  })
})

function localUploadPath(uploadUrl: string): string {
  const pathname = new URL(uploadUrl).pathname.replace(/^\/api/, "")
  if (!pathname.includes("/local-presign-upload/")) {
    throw new Error(`Unexpected upload URL ${uploadUrl}`)
  }
  return pathname
}
