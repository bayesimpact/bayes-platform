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

describe("DocumentTags - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
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
    return { organization, project }
  }

  const subject = async (payload?: typeof DocumentTagsRoutes.createOne.request) =>
    request({
      route: DocumentTagsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: payload,
    })

  it("should create a document tag and return it", async () => {
    await createContext()

    const response = await subject({
      payload: {
        name: "New Tag",
        description: "A test tag",
      },
    })

    expectResponse(response, 201)
    expect(response.body.data.name).toBe("New Tag")
    expect(response.body.data.description).toBe("A test tag")
    expect(response.body.data.projectId).toBe(projectId)
    expect(response.body.data.id).toBeDefined()

    const documentTagRepository = setup.getRepository(DocumentTag)
    const documentTag = await documentTagRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(documentTag).not.toBeNull()
    expect(documentTag?.name).toBe("New Tag")
    await expectActivityCreated("documentTag.create")
  })

  it("should create a document tag without description", async () => {
    await createContext()

    const response = await subject({ payload: { name: "Minimal Tag" } })

    expectResponse(response, 201)
    expect(response.body.data.name).toBe("Minimal Tag")
    expect(response.body.data.description).toBeUndefined()
    expect(response.body.data.parentId).toBeUndefined()
  })

  it("should reject creating a tag whose parent is the public-documents tag", async () => {
    const { organization, project } = await createContext()

    const documentTagRepository = setup.getRepository(DocumentTag)
    const publicDocumentsTag = documentTagFactory
      .transient({ organization, project })
      .build({ name: PUBLIC_DOCUMENTS_TAG_NAME })
    await documentTagRepository.save(publicDocumentsTag)

    const response = await subject({
      payload: { name: "Child Tag", parentId: publicDocumentsTag.id },
    })

    expectResponse(response, 400, `Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot have children.`)

    const childCount = await documentTagRepository.count({ where: { name: "Child Tag" } })
    expect(childCount).toBe(0)
  })
})
