import { randomUUID } from "node:crypto"
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
import { createOrganizationWithDocument } from "@/domains/organizations/organization.factory"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentsModule } from "../documents.module"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Documents - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = `auth0|${randomUUID()}`
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
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, document } = await createOrganizationWithDocument(
      repositories,
      {
        user: { auth0Id },
        projectMembership: { role: "admin" },
      },
    )
    organizationId = organization.id
    projectId = project.id
    documentId = document.id
    auth0Id = user.auth0Id
    return { organization, project, document }
  }

  const subject = async () =>
    request({
      route: DocumentsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, documentId }),
      token: accessToken,
    })

  it("should delete a document and return success", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { success: true } })

    const deletedDocument = await repositories.documentRepository.findOne({
      where: { id: documentId },
    })
    expect(deletedDocument).toBeNull()
    await expectActivityCreated("document.delete")
  })
})
