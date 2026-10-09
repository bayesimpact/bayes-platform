import { DocumentsRoutes } from "@caseai-connect/api-contracts"
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
import { createDocumentForProject } from "@/domains/documents/document.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentsModule } from "../documents.module"
import { DocumentTag } from "../tags/document-tag.entity"
import { documentTagFactory } from "../tags/document-tag.factory"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Documents - confirmMany", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        withDocumentAuthAndEmbeddingsMocks(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
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
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!

    const pendingDocument = await createDocumentForProject({
      repositories,
      organization,
      project,
      params: {
        document: {
          sourceType: "project",
          uploadStatus: "pending",
        },
      },
    })
    documentId = pendingDocument.id
    return { organization, project }
  }

  const subject = async (payload?: typeof DocumentsRoutes.confirmMany.request) =>
    request({
      route: DocumentsRoutes.confirmMany,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("should confirm uploaded documents", async () => {
    await createContext()

    const response = await subject({
      payload: {
        documentIds: [documentId],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]?.id).toBe(documentId)

    const document = await repositories.documentRepository.findOne({ where: { id: documentId } })
    expect(document?.uploadStatus).toBe("uploaded")
    await expectActivityCreated("document.createMany")
  })

  it("should attach tags when tagIds are provided", async () => {
    const { organization, project } = await createContext()

    const documentTagRepository = setup.getRepository(DocumentTag)
    const tag = documentTagFactory.transient({ organization, project }).build({
      name: "Upload batch tag",
    })
    await documentTagRepository.save(tag)

    const response = await subject({
      payload: {
        documentIds: [documentId],
        tagIds: [tag.id],
      },
    })

    expectResponse(response, 201)
    expect(response.body.data[0]?.tagIds).toContain(tag.id)

    const documentWithTags = await repositories.documentRepository.findOne({
      where: { id: documentId },
      relations: ["tags"],
    })
    expect(documentWithTags?.tags?.map((documentTag) => documentTag.id)).toContain(tag.id)
  })
})
