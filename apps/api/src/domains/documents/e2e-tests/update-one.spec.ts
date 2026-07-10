import { randomUUID } from "node:crypto"
import { DocumentsRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
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
import { createOrganizationWithDocument } from "@/domains/organizations/organization.factory"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { Document } from "../document.entity"
import { DocumentsModule } from "../documents.module"
import { DocumentTag } from "../tags/document-tag.entity"
import { documentTagFactory } from "../tags/document-tag.factory"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Documents - updateOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = `auth0|${randomUUID()}`
  let tagAId: string
  let tagBId: string
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        withDocumentAuthAndEmbeddingsMocks(moduleBuilder, () => auth0Id),
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
    auth0Id = `auth0|${randomUUID()}`
    organizationId = randomUUID()
    projectId = randomUUID()
    documentId = randomUUID()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, document } = await createOrganizationWithDocument(repositories, {
      user: { auth0Id },
    })
    organizationId = organization.id
    projectId = project.id
    documentId = document.id

    const documentTagRepository = setup.getRepository(DocumentTag)
    const tagA = documentTagFactory.transient({ organization, project }).build({ name: "Tag A" })
    const tagB = documentTagFactory.transient({ organization, project }).build({ name: "Tag B" })
    await documentTagRepository.save([tagA, tagB])
    tagAId = tagA.id
    tagBId = tagB.id
    return { organization, project, document }
  }

  const subject = async (payload?: typeof DocumentsRoutes.updateOne.request) =>
    request({
      route: DocumentsRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, documentId }),
      token: accessToken,
      request: payload,
    })

  it("should update a document title and return success", async () => {
    await createContext()

    const response = await subject({ payload: { title: "Updated Title" } })

    expectResponse(response, 200)
    expect(response.body.data.success).toBe(true)

    const documentRepository = setup.getRepository(Document)
    const updated = await documentRepository.findOne({ where: { id: documentId } })
    expect(updated?.title).toBe("Updated Title")
    await expectActivityCreated("document.update")
  })

  it("should update tags", async () => {
    const { document } = await createContext()
    const originalTitle = document.title

    await subject({ payload: { tagsToAdd: [tagAId] } })
    const response = await subject({ payload: { tagsToAdd: [tagBId] } })

    expectResponse(response, 200)

    const documentRepository = setup.getRepository(Document)
    const updated = await documentRepository.findOne({
      where: { id: documentId },
      relations: ["tags"],
    })
    expect(updated?.title).toBe(originalTitle)
    expect(updated?.tags).toHaveLength(2)
  })
})
