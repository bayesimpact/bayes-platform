import { DocumentSourcesRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { documentTagFactory } from "@/domains/documents/tags/document-tag.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentsModule } from "../documents.module"
import { DocumentSourcesService } from "../sources/document-sources.service"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Document sources - updateOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let documentSourcesService: DocumentSourcesService

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: (moduleBuilder) =>
        withDocumentAuthAndEmbeddingsMocks(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    documentSourcesService = setup.module.get(DocumentSourcesService)
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
    const documentSource = await documentSourcesService.createOne(
      { organizationId, projectId },
      {
        name: "Helpful Assistant",
        type: "site",
        externalId: "site-1",
        baseUrl: null,
        config: null,
      },
    )
    const [productTag, pricingTag] = await setup
      .getRepository(DocumentTag)
      .save([
        documentTagFactory.transient({ organization, project }).build({ name: "Product" }),
        documentTagFactory.transient({ organization, project }).build({ name: "Pricing" }),
      ])
    return { documentSource, productTag: productTag!, pricingTag: pricingTag! }
  }

  const subject = (
    documentSourceId: string,
    payload: { tagsToAdd?: string[]; tagsToRemove?: string[] },
  ) =>
    request({
      route: DocumentSourcesRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, documentSourceId }),
      token: accessToken,
      request: { payload },
    })

  const listTagIds = async () => {
    const response = await request({
      route: DocumentSourcesRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })
    return response.body.data[0]?.tagIds ?? []
  }

  it("adds and removes tags on a source", async () => {
    const { documentSource, productTag, pricingTag } = await createContext()

    expectResponse(
      await subject(documentSource.id, { tagsToAdd: [productTag.id, pricingTag.id] }),
      200,
    )
    expect([...(await listTagIds())].sort()).toEqual([productTag.id, pricingTag.id].sort())

    expectResponse(await subject(documentSource.id, { tagsToRemove: [productTag.id] }), 200)
    expect(await listTagIds()).toEqual([pricingTag.id])
  })

  it("ignores a tag that the source already has", async () => {
    const { documentSource, productTag } = await createContext()

    expectResponse(await subject(documentSource.id, { tagsToAdd: [productTag.id] }), 200)
    expectResponse(await subject(documentSource.id, { tagsToAdd: [productTag.id] }), 200)
    expect(await listTagIds()).toEqual([productTag.id])
  })

  it("rejects a tag of another project", async () => {
    const { documentSource } = await createContext()
    const { organization: otherOrganization, project: otherProject } =
      await createOrganizationWithProject(repositories)
    const otherTag = await setup
      .getRepository(DocumentTag)
      .save(
        documentTagFactory
          .transient({ organization: otherOrganization, project: otherProject })
          .build(),
      )

    expectResponse(await subject(documentSource.id, { tagsToAdd: [otherTag.id] }), 404)
  })

  it("returns 404 for an unknown source", async () => {
    const { productTag } = await createContext()
    expectResponse(
      await subject("00000000-0000-0000-0000-000000000000", { tagsToAdd: [productTag.id] }),
      404,
    )
  })
})
