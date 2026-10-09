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
import { projectFactory } from "@/domains/projects/project.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { DocumentTag } from "../document-tag.entity"
import { documentTagFactory } from "../document-tag.factory"
import { DocumentTagsModule } from "../document-tags.module"

describe("DocumentTags - updateOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentTagId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentTagsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
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

    const documentTagRepository = setup.getRepository(DocumentTag)
    const documentTag = documentTagFactory
      .transient({ organization, project })
      .build({ name: "Original Name", description: "Original description" })
    await documentTagRepository.save(documentTag)
    documentTagId = documentTag.id

    return { organization, project, documentTag }
  }

  const subject = async (payload?: typeof DocumentTagsRoutes.updateOne.request) =>
    request({
      route: DocumentTagsRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, documentTagId }),
      token: accessToken,
      request: payload,
    })

  it("should update a document tag", async () => {
    const { documentTag } = await createContext()

    const response = await subject({
      payload: {
        name: "Updated Name",
        description: documentTag.description ?? undefined,
        parentId: documentTag.parentId ?? undefined,
      },
    })

    expectResponse(response, 200)
    expect(response.body.data.success).toBe(true)

    const documentTagRepository = setup.getRepository(DocumentTag)
    const updated = await documentTagRepository.findOne({ where: { id: documentTagId } })
    expect(updated?.name).toBe("Updated Name")
    expect(updated?.description).toBe("Original description")
    await expectActivityCreated("documentTag.update")
  })

  it("should reject reparenting a tag under the public-documents tag", async () => {
    const { organization, project, documentTag } = await createContext()

    const documentTagRepository = setup.getRepository(DocumentTag)
    const publicDocumentsTag = documentTagFactory
      .transient({ organization, project })
      .build({ name: PUBLIC_DOCUMENTS_TAG_NAME })
    await documentTagRepository.save(publicDocumentsTag)

    const response = await subject({
      payload: {
        name: documentTag.name,
        description: documentTag.description ?? undefined,
        parentId: publicDocumentsTag.id,
      },
    })

    expectResponse(response, 400, `Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot have children.`)

    const updated = await documentTagRepository.findOne({ where: { id: documentTagId } })
    expect(updated?.parentId).toBeNull()
  })

  it("should reject a parent from another project of the same organization", async () => {
    const { organization, documentTag } = await createContext()
    const otherProject = projectFactory.transient({ organization }).build()
    await repositories.projectRepository.save(otherProject)
    const foreignTag = await setup
      .getRepository(DocumentTag)
      .save(
        documentTagFactory
          .transient({ organization, project: otherProject })
          .build({ name: "Other project" }),
      )

    const response = await subject({
      payload: {
        name: documentTag.name,
        description: documentTag.description ?? undefined,
        parentId: foreignTag.id,
      },
    })

    expectResponse(response, 404, `DocumentTag with id ${foreignTag.id} not found`)
    const updated = await setup.getRepository(DocumentTag).findOne({ where: { id: documentTagId } })
    expect(updated?.parentId).toBeNull()
  })

  it("should reject a parent from another organization", async () => {
    const { documentTag } = await createContext()
    const other = await createOrganizationWithProject(repositories)
    const foreignTag = await setup
      .getRepository(DocumentTag)
      .save(
        documentTagFactory
          .transient({ organization: other.organization, project: other.project })
          .build({ name: "Other organization" }),
      )

    const response = await subject({
      payload: {
        name: documentTag.name,
        description: documentTag.description ?? undefined,
        parentId: foreignTag.id,
      },
    })

    expectResponse(response, 404, `DocumentTag with id ${foreignTag.id} not found`)
    const updated = await setup.getRepository(DocumentTag).findOne({ where: { id: documentTagId } })
    expect(updated?.parentId).toBeNull()
  })

  it("should reject a tag as its own parent", async () => {
    const { documentTag } = await createContext()

    const response = await subject({
      payload: {
        name: documentTag.name,
        description: documentTag.description ?? undefined,
        parentId: documentTag.id,
      },
    })

    expectResponse(response, 400, "A tag cannot be its own parent.")
    const updated = await setup.getRepository(DocumentTag).findOne({ where: { id: documentTagId } })
    expect(updated?.parentId).toBeNull()
  })
})
