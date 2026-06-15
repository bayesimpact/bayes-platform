import { DocumentTagsRoutes, PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { DocumentTag } from "../document-tag.entity"
import { documentTagFactory } from "../document-tag.factory"
import { DocumentTagsModule } from "../document-tags.module"

describe("DocumentTags - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentTagId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentTagsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
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
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const documentTagRepository = setup.getRepository(DocumentTag)
    const documentTag = documentTagFactory.transient({ organization, project }).build()
    await documentTagRepository.save(documentTag)
    documentTagId = documentTag.id

    return { organization, project, documentTag }
  }

  const subject = async () =>
    request({
      route: DocumentTagsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, documentTagId }),
      token: accessToken,
    })

  it("should delete a document tag and return success", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.success).toBe(true)

    const documentTagRepository = setup.getRepository(DocumentTag)
    const deleted = await documentTagRepository.findOne({ where: { id: documentTagId } })
    expect(deleted).toBeNull()
    await expectActivityCreated("documentTag.delete")
  })

  it("should return 404 for a non-existent document tag ID", async () => {
    await createContext()
    documentTagId = "00000000-0000-0000-0000-000000000000"

    const response = await subject()

    expectResponse(response, 404)
  })

  it("should reject deleting the public-documents tag", async () => {
    const { organization, project } = await createContext()

    const documentTagRepository = setup.getRepository(DocumentTag)
    const publicDocumentsTag = documentTagFactory
      .transient({ organization, project })
      .build({ name: PUBLIC_DOCUMENTS_TAG_NAME })
    await documentTagRepository.save(publicDocumentsTag)
    documentTagId = publicDocumentsTag.id

    const response = await subject()

    expectResponse(response, 400, `Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot be deleted.`)

    const stillExists = await documentTagRepository.findOne({ where: { id: documentTagId } })
    expect(stillExists).not.toBeNull()
  })
})
