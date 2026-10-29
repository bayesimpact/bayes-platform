import { randomUUID } from "node:crypto"
import {
  DocumentSourcesRoutes,
  DocumentsRoutes,
  EmbeddingModel,
  MimeTypes,
  ProjectEmbeddingModelsRoutes,
  PUBLIC_DOCUMENTS_TAG_NAME,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import type { Repository } from "typeorm"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { documentFactory } from "@/domains/documents/document.factory"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { documentTagFactory } from "@/domains/documents/tags/document-tag.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import {
  addFeature,
  createOrganizationWithAgent,
  createOrganizationWithDocument,
} from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { mockForeignAuthSubject, mockOidcEmailForSub } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { Document } from "../document.entity"
import { DocumentsModule } from "../documents.module"
import { DocumentSourcesService } from "../sources/document-sources.service"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Documents - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let _documentRepository: Repository<Document>

  // Variables for the tests
  let organizationId: string | null = "random-organization-id"
  let projectId: string | null = "random-project-id"
  let documentId: string | null = "random-document-id"
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    // The routes only enable a model the deployment has an embedder for.
    process.env.EMBEDDER_BGE_M3_URL = "http://embedder.test"
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: (moduleBuilder) =>
        withDocumentAuthAndEmbeddingsMocks(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    _documentRepository = setup.getRepository(Document)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = "random-organization-id"
    projectId = "random-project-id"
    documentId = "random-document-id"
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (
    role: ProjectRoleKey = "project_owner",
    document: Partial<Document> = {},
  ) => {
    const created = await createOrganizationWithDocument(repositories, {
      user: { authSubject },
      projectMembership: { roleKeys: [role] },
      document,
    })
    organizationId = created.organization.id
    projectId = created.project.id
    documentId = created.document.id
    accessToken = "token"
    return { organization: created.organization, project: created.project }
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
  }: Awaited<ReturnType<typeof createContextForRole>>) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { roleKeys: ["org_admin"] },
    })
    authSubject = organizationAdminAuthSubject
  }

  describe("DocumentsRoutes.presignMany", () => {
    const subject = async () =>
      request({
        route: DocumentsRoutes.presignMany,
        pathParams: removeNullish({ organizationId, projectId, sourceType: "project" }),
        token: accessToken ?? undefined,
        request: {
          payload: { files: [{ fileName: "notes.pdf", mimeType: MimeTypes.pdf, size: 1024 }] },
        },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("doesn't allow a simple member to upload a document", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["project_owner"], ["project_admin"]] as const)("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 201)
    })
  })

  describe("DocumentsRoutes.confirmMany", () => {
    const subject = async () =>
      request({
        route: DocumentsRoutes.confirmMany,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: { payload: { documentIds: documentId ? [documentId] : [] } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner", { uploadStatus: "pending" })
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("doesn't allow a simple member to confirm an upload", async () => {
      await createContextForRole("project_member", { uploadStatus: "pending" })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["project_owner"], ["project_admin"]] as const)("allows a %s", async (role) => {
      await createContextForRole(role, { uploadStatus: "pending" })
      expectResponse(await subject(), 201)
    })
  })

  describe("DocumentsRoutes.updateOne", () => {
    const subject = async () =>
      request({
        route: DocumentsRoutes.updateOne,
        pathParams: removeNullish({ organizationId, projectId, documentId }),
        token: accessToken ?? undefined,
        request: { payload: { title: "Renamed" } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires the document to be part of the project", async () => {
      const { organization } = await createContextForRole("project_owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("doesn't allow a simple member to update a document", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["project_owner"], ["project_admin"]] as const)("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  describe("DocumentsRoutes.getAll", () => {
    const subject = async (payload?: typeof DocumentsRoutes.getAll.request) =>
      request({
        route: DocumentsRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: payload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("project_owner")
      projectId = null // reset to a non-null value
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to get all documents", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["project_owner"], ["project_admin"]] as const)("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  describe("DocumentsRoutes.streamEmbeddingStatus", () => {
    const subject = async () =>
      request({
        route: DocumentsRoutes.streamEmbeddingStatus,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("project_owner")
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to stream embedding statuses", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("DocumentsRoutes.deleteOne", () => {
    const subject = async () =>
      request({
        route: DocumentsRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, documentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("project_owner")
      // Use a valid UUID format that doesn't exist in the database
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the document to be part of the project", async () => {
      const { organization } = await createContextForRole("project_owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404) //exception thrown by guard
    })
    it("doesn't allow a simple member to delete a document", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["project_owner"], ["project_admin"]] as const)("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  describe("DocumentsRoutes.getTemporaryUrl", () => {
    const subject = async () =>
      request({
        route: DocumentsRoutes.getTemporaryUrl,
        pathParams: removeNullish({ organizationId, projectId, documentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("project_owner")
      // Use a valid UUID format that doesn't exist in the database
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the document to be part of the project", async () => {
      const { organization } = await createContextForRole("project_owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404) //exception thrown by guard
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["project_owner"], ["project_admin"]] as const)("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 201)
    })
  })

  describe("DocumentsRoutes.getIsPublic", () => {
    const subject = async () =>
      request({
        route: DocumentsRoutes.getIsPublic,
        pathParams: removeNullish({ organizationId, projectId, documentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("project_owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the document to be part of the project", async () => {
      const { organization } = await createContextForRole("project_owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([
      ["project_owner"],
      ["project_admin"],
      ["project_member"],
    ] as const)("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  describe("DocumentsRoutes.reprocessOne", () => {
    const subject = async () =>
      request({
        route: DocumentsRoutes.reprocessOne,
        pathParams: removeNullish({ organizationId, projectId, documentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("project_owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the document to be part of the project", async () => {
      const { organization } = await createContextForRole("project_owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to reprocess a document", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["project_owner"], ["project_admin"]] as const)("allows a %s", async (role) => {
      await createContextForRole(role, { sourceType: "project", embeddingStatus: "failed" })
      expectResponse(await subject(), 201)
    })
  })

  // A campaign role gives `project.read` on the campaign's project, without a project row, but no
  // document key.
  describe.each([
    ["review_campaign_tester"],
    ["review_campaign_reviewer"],
  ] as const)("a %s", (roleKey) => {
    const createCampaignParticipantContext = async ({ isPublic }: { isPublic: boolean }) => {
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        { agent: { type: "conversation" } },
      )
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      const document = documentFactory.transient({ organization, project }).build()
      if (isPublic) {
        const publicDocumentsTag = await setup
          .getRepository(DocumentTag)
          .save(
            documentTagFactory
              .transient({ organization, project })
              .build({ name: PUBLIC_DOCUMENTS_TAG_NAME }),
          )
        document.tags = [publicDocumentsTag]
      }
      await repositories.documentRepository.save(document)
      const participantAuthSubject = `oidc|${randomUUID()}`
      await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        roleKeys: [roleKey],
        user: {
          authSubject: participantAuthSubject,
          email: mockOidcEmailForSub(participantAuthSubject),
        },
      })

      authSubject = participantAuthSubject
      organizationId = organization.id
      projectId = project.id
      documentId = document.id
      accessToken = "token"
    }

    const requestRoute = <
      Route extends
        | typeof DocumentsRoutes.getIsPublic
        | typeof DocumentsRoutes.getTemporaryUrl
        | typeof DocumentsRoutes.getAll,
    >(
      route: Route,
    ) =>
      request({
        route,
        pathParams: removeNullish({ organizationId, projectId, documentId, sourceType: "project" }),
        token: accessToken ?? undefined,
      })

    it.each([
      [true],
      [false],
    ])("can check whether a document is public (public: %s)", async (isPublic) => {
      await createCampaignParticipantContext({ isPublic })

      const response = await requestRoute(DocumentsRoutes.getIsPublic)

      expectResponse(response, 200)
      expect(response.body.data.isPublicDocument).toBe(isPublic)
    })

    it("can download a document tagged public", async () => {
      await createCampaignParticipantContext({ isPublic: true })
      expectResponse(await requestRoute(DocumentsRoutes.getTemporaryUrl), 201)
    })

    it("cannot download a document that is not public", async () => {
      await createCampaignParticipantContext({ isPublic: false })
      expectResponse(
        await requestRoute(DocumentsRoutes.getTemporaryUrl),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })

    it("cannot list the project's documents", async () => {
      await createCampaignParticipantContext({ isPublic: true })
      expectResponse(
        await requestRoute(DocumentsRoutes.getAll),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })

    it("cannot upload a document", async () => {
      await createCampaignParticipantContext({ isPublic: false })
      expectResponse(
        await request({
          route: DocumentsRoutes.presignMany,
          pathParams: removeNullish({ organizationId, projectId, sourceType: "project" }),
          token: accessToken ?? undefined,
          request: {
            payload: { files: [{ fileName: "notes.pdf", mimeType: MimeTypes.pdf, size: 1024 }] },
          },
        }),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })
  })

  // Local embedding models are managed from the documents domain (same admin policy).
  describe("ProjectEmbeddingModelsRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: ProjectEmbeddingModelsRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("project_owner")
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to list the embedding models", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([
      ["project_owner"],
      ["project_admin"],
    ] as const)("allows a %s to list", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  describe("ProjectEmbeddingModelsRoutes.createOne", () => {
    const subject = async () =>
      request({
        route: ProjectEmbeddingModelsRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: { payload: { modelName: EmbeddingModel.BgeM3 } },
      })
    const createContextWithFeature = async (role: ProjectRoleKey) => {
      const { project } = await createContextForRole(role)
      await addFeature({
        featureFlagRepository: repositories.featureFlagRepository,
        projectId: project.id,
        featureFlagKey: "local-embeddings",
      })
    }

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextWithFeature("project_owner")
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextWithFeature("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to enable a model", async () => {
      await createContextWithFeature("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([
      ["project_owner"],
      ["project_admin"],
    ] as const)("allows a %s to enable a model", async (role) => {
      await createContextWithFeature(role)
      expectResponse(await subject(), 201)
    })
  })

  describe("DocumentSourcesRoutes.updateOne", () => {
    let documentSourceId: string | null = "random-document-source-id"
    let documentTagId = "random-document-tag-id"

    const createSourceForRole = async (role: ProjectRoleKey) => {
      const context = await createContextForRole(role)
      const connectScope = {
        organizationId: context.organization.id,
        projectId: context.project.id,
      }
      const documentSource = await setup.module
        .get(DocumentSourcesService)
        .createOne(connectScope, {
          name: "Helpful Assistant",
          type: "site",
          externalId: "site-1",
          baseUrl: null,
          config: null,
        })
      const documentTag = await setup
        .getRepository(DocumentTag)
        .save(documentTagFactory.transient(context).build({ name: "Product" }))
      documentSourceId = documentSource.id
      documentTagId = documentTag.id
      return context
    }

    const subject = async () =>
      request({
        route: DocumentSourcesRoutes.updateOne,
        pathParams: removeNullish({ organizationId, projectId, documentSourceId }),
        token: accessToken ?? undefined,
        request: { payload: { tagsToAdd: [documentTagId] } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids an organization admin who holds no project role", async () => {
      const context = await createSourceForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("doesn't allow a simple member to tag a source", async () => {
      await createSourceForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it.each([["project_owner"], ["project_admin"]] as const)("allows a %s", async (role) => {
      await createSourceForRole(role)
      expectResponse(await subject(), 200)
    })
  })
})
