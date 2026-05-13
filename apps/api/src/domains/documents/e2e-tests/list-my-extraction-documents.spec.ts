import { DocumentsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { documentFactory } from "@/domains/documents/document.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { createSingleUser } from "@/domains/users/user.factory"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentsModule } from "../documents.module"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Documents - listMyExtractionDocuments", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: (moduleBuilder) =>
        withDocumentAuthAndEmbeddingsMocks(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
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

  const createContext = async (role: "owner" | "admin" | "member" = "member") => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      projectMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { user, organization, project }
  }

  const subject = async () =>
    request({
      route: DocumentsRoutes.listMyExtractionDocuments,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("returns only extraction documents owned by the current user", async () => {
    const { user, organization, project } = await createContext()
    const otherUser = await createSingleUser(repositories.userRepository)

    const myExtraction = documentFactory.transient({ organization, project }).build({
      title: "My extraction",
      sourceType: "extraction",
      userId: user.id,
    })
    const otherUserExtraction = documentFactory.transient({ organization, project }).build({
      title: "Other user extraction",
      sourceType: "extraction",
      userId: otherUser.id,
    })
    const orphanExtraction = documentFactory.transient({ organization, project }).build({
      title: "Orphan extraction",
      sourceType: "extraction",
      userId: null,
    })
    const myProjectDoc = documentFactory.transient({ organization, project }).build({
      title: "My project doc",
      sourceType: "project",
      userId: user.id,
    })

    await repositories.documentRepository.save([
      myExtraction,
      otherUserExtraction,
      orphanExtraction,
      myProjectDoc,
    ])

    const response = await subject()

    expectResponse(response, 200)
    const documents = response.body.data
    expect(documents.map((document: { title: string }) => document.title)).toEqual([
      "My extraction",
    ])
  })

  it("does not include extraction documents from another project", async () => {
    const { user, organization, project } = await createContext()

    const myExtraction = documentFactory.transient({ organization, project }).build({
      title: "My extraction in current project",
      sourceType: "extraction",
      userId: user.id,
    })

    const { project: otherProject } = await createOrganizationWithProject(repositories)
    const extractionInOtherProject = documentFactory
      .transient({ organization, project: otherProject })
      .build({
        title: "My extraction in other project",
        sourceType: "extraction",
        userId: user.id,
      })

    await repositories.documentRepository.save([myExtraction, extractionInOtherProject])

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.map((document: { title: string }) => document.title)).toEqual([
      "My extraction in current project",
    ])
  })

  it("excludes documents whose upload is still pending", async () => {
    const { user, organization, project } = await createContext()

    const uploadedExtraction = documentFactory.transient({ organization, project }).build({
      title: "Uploaded extraction",
      sourceType: "extraction",
      userId: user.id,
      uploadStatus: "uploaded",
    })
    const pendingExtraction = documentFactory.transient({ organization, project }).build({
      title: "Pending extraction",
      sourceType: "extraction",
      userId: user.id,
      uploadStatus: "pending",
    })

    await repositories.documentRepository.save([uploadedExtraction, pendingExtraction])

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.map((document: { title: string }) => document.title)).toEqual([
      "Uploaded extraction",
    ])
  })

  it("returns an empty array when the user has no extraction documents", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })

  it("sorts documents newest first", async () => {
    const { user, organization, project } = await createContext()

    const older = documentFactory.transient({ organization, project }).build({
      title: "Older",
      sourceType: "extraction",
      userId: user.id,
      createdAt: new Date("2025-01-01T00:00:00Z"),
    })
    const newer = documentFactory.transient({ organization, project }).build({
      title: "Newer",
      sourceType: "extraction",
      userId: user.id,
      createdAt: new Date("2025-06-01T00:00:00Z"),
    })

    await repositories.documentRepository.save([older, newer])

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.map((document: { title: string }) => document.title)).toEqual([
      "Newer",
      "Older",
    ])
  })
})
