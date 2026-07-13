import { randomUUID } from "node:crypto"
import { EvaluationExtractionDatasetsRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithDocument } from "@/domains/organizations/organization.factory"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  mockAuth0EmailForSub,
  mockForeignAuth0Id,
  setupUserGuardForTesting,
} from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { EvaluationsModule } from "../../../evaluations.module"
import { EvaluationExtractionDataset } from "../evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../evaluation-extraction-dataset.factory"

describe("EvaluationExtractionDatasets - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let datasetRepository: Repository<EvaluationExtractionDataset>

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let documentId: string | null = randomUUID()
  let datasetId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    datasetRepository = setup.getRepository(EvaluationExtractionDataset)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    documentId = randomUUID()
    datasetId = randomUUID()
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: ProjectMembershipRole = "owner") => {
    const { user, organization, project, document } = await createOrganizationWithDocument(
      repositories,
      {
        user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
        projectMembership: { role },
      },
    )
    organizationId = organization.id
    projectId = project.id
    documentId = document.id
    accessToken = "token"
    auth0Id = user.auth0Id
    return { organization, project, document }
  }

  describe("EvaluationExtractionDatasetsRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionDatasetsRoutes.getAll,
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
      await createContextForRole("owner")
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to get all datasets", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionDatasetsRoutes.getRecords", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionDatasetsRoutes.getRecords,
        pathParams: removeNullish({ organizationId, projectId, datasetId }),
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
      await createContextForRole("owner")
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to get records", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionDatasetsRoutes.getAllFiles", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionDatasetsRoutes.getAllFiles,
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
      await createContextForRole("owner")
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to get all files", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionDatasetsRoutes.getFileColumns", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionDatasetsRoutes.getFileColumns,
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
      await createContextForRole("owner")
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the document to be part of the project", async () => {
      const { organization } = await createContextForRole("owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to get file columns", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionDatasetsRoutes.createOne", () => {
    const payload: typeof EvaluationExtractionDatasetsRoutes.createOne.request = {
      payload: { name: "Test Dataset" },
    }

    const subject = async (
      requestPayload?: typeof EvaluationExtractionDatasetsRoutes.createOne.request,
    ) =>
      request({
        route: EvaluationExtractionDatasetsRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId }),
        token: accessToken ?? undefined,
        request: requestPayload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(payload), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(payload), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = null
      expectResponse(await subject(payload), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(payload), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to create a dataset", async () => {
      await createContextForRole("member")
      expectResponse(await subject(payload), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionDatasetsRoutes.updateOne", () => {
    const payload: typeof EvaluationExtractionDatasetsRoutes.updateOne.request = {
      payload: { name: "Updated Dataset", columns: [] },
    }

    const subject = async (
      requestPayload?: typeof EvaluationExtractionDatasetsRoutes.updateOne.request,
    ) =>
      request({
        route: EvaluationExtractionDatasetsRoutes.updateOne,
        pathParams: removeNullish({
          organizationId,
          projectId,
          datasetId,
          documentId,
        }),
        token: accessToken ?? undefined,
        request: requestPayload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(payload), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(payload), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(payload), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(payload), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires the document to be part of the project", async () => {
      const { organization } = await createContextForRole("owner")
      const project2 = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      projectId = project2.id
      expectResponse(await subject(payload), 404)
    })
    it("doesn't allow a simple member to update a dataset", async () => {
      await createContextForRole("member")
      expectResponse(await subject(payload), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionDatasetsRoutes.renameOne", () => {
    const payload: typeof EvaluationExtractionDatasetsRoutes.renameOne.request = {
      payload: { name: "Renamed Dataset" },
    }

    const subject = async (
      requestPayload?: typeof EvaluationExtractionDatasetsRoutes.renameOne.request,
    ) =>
      request({
        route: EvaluationExtractionDatasetsRoutes.renameOne,
        pathParams: removeNullish({ organizationId, projectId, datasetId }),
        token: accessToken ?? undefined,
        request: requestPayload,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(payload), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      organizationId = null
      expectResponse(await subject(payload), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = null
      expectResponse(await subject(payload), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(payload), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to rename a dataset", async () => {
      await createContextForRole("member")
      expectResponse(await subject(payload), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("EvaluationExtractionDatasetsRoutes.deleteOne", () => {
    const subject = async () =>
      request({
        route: EvaluationExtractionDatasetsRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, datasetId }),
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
      await createContextForRole("owner")
      projectId = null
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to delete a dataset", async () => {
      const { organization, project } = await createContextForRole("member")
      const dataset = evaluationExtractionDatasetFactory
        .transient({ organization, project })
        .build()
      await datasetRepository.save(dataset)
      datasetId = dataset.id
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
