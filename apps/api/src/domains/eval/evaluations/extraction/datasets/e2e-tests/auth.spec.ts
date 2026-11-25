import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import { EvalExtractionDatasetsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { evaluationExtractionDatasetFactory } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.factory"
import { evaluationExtractionDatasetDocumentFactory } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.factory"
import {
  SIMPLE_CSV_COLUMNS,
  SIMPLE_CSV_CONTENT,
} from "@/domains/evaluations/extraction/runs/e2e-tests/csv-dataset.helpers"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../../../test/schema-request"
import { EvalModule } from "../../../../eval.module"

type RouteName = keyof typeof EvalExtractionDatasetsRoutes

type RouteCase = {
  /** The status of an allowed call. */
  status: number
  /** The route names a dataset in its path. */
  hasDataset: boolean
  /** The route names a file in its path. */
  hasFile: boolean
  /**
   * What an unknown dataset answers: a 404 from the context resolver (`@AddContext` today) or
   * from the service, and an empty page for `getRecords`, which reads by project and dataset id.
   */
  unknownDatasetStatus: number
}

const ROUTE_CASES: Record<RouteName, RouteCase> = {
  getAllFiles: { status: 200, hasDataset: false, hasFile: false, unknownDatasetStatus: 200 },
  presignFile: { status: 201, hasDataset: false, hasFile: false, unknownDatasetStatus: 201 },
  confirmFile: { status: 201, hasDataset: false, hasFile: true, unknownDatasetStatus: 201 },
  getFileColumns: { status: 200, hasDataset: false, hasFile: true, unknownDatasetStatus: 200 },
  deleteFile: { status: 200, hasDataset: false, hasFile: true, unknownDatasetStatus: 200 },
  getAll: { status: 200, hasDataset: false, hasFile: false, unknownDatasetStatus: 200 },
  createOne: { status: 201, hasDataset: false, hasFile: false, unknownDatasetStatus: 201 },
  setUpOne: { status: 200, hasDataset: true, hasFile: true, unknownDatasetStatus: 404 },
  renameOne: { status: 200, hasDataset: true, hasFile: false, unknownDatasetStatus: 404 },
  deleteOne: { status: 200, hasDataset: true, hasFile: false, unknownDatasetStatus: 404 },
  getRecords: { status: 200, hasDataset: true, hasFile: false, unknownDatasetStatus: 200 },
}

const ROUTE_NAMES = Object.keys(ROUTE_CASES) as RouteName[]

const DATASET_ROUTE_NAMES = ROUTE_NAMES.filter((routeName) => ROUTE_CASES[routeName].hasDataset)

const FILE_ROUTE_NAMES = ROUTE_NAMES.filter((routeName) => ROUTE_CASES[routeName].hasFile)

const mockFileStorageService = {
  readFile: jest.fn(),
  createReadStream: jest.fn(),
  save: jest.fn(),
  deleteFile: jest.fn(),
  getTemporaryUrl: jest.fn(),
  generateSignedUploadUrl: jest.fn().mockResolvedValue("https://storage.example.com/upload"),
  buildStorageRelativePath: jest.fn(
    ({ documentId, extension }: { documentId: string; extension: string }) =>
      `evaluation-extraction-datasets/${documentId}.${extension}`,
  ),
}

describe("Evaluation extraction datasets - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let datasetId: string = randomUUID()
  let documentId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    datasetId = randomUUID()
    documentId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
    mockFileStorageService.readFile.mockResolvedValue(Buffer.from(SIMPLE_CSV_CONTENT))
    mockFileStorageService.createReadStream.mockImplementation(() =>
      Readable.from(Buffer.from(SIMPLE_CSV_CONTENT)),
    )
    mockFileStorageService.deleteFile.mockResolvedValue(undefined)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A project with a dataset and an uploaded file, and a caller with the given project roles. */
  const createContextForRoles = async (...roleKeys: ProjectRoleKey[]) => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      projectMembership: { roleKeys },
    })
    const dataset = await repositories.evaluationExtractionDatasetRepository.save(
      evaluationExtractionDatasetFactory.transient({ organization, project }).build(),
    )
    const document = await repositories.evaluationExtractionDatasetDocumentRepository.save(
      evaluationExtractionDatasetDocumentFactory.transient({ organization, project }).build(),
    )
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id
    documentId = document.id
    return { organization, project }
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
  }: Awaited<ReturnType<typeof createContextForRoles>>) => {
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

  const subjects: Record<RouteName, () => ReturnType<SchemaRequester>> = {
    getAllFiles: () =>
      request({
        route: EvalExtractionDatasetsRoutes.getAllFiles,
        pathParams: { organizationId, projectId },
        token: accessToken,
      }),
    presignFile: () =>
      request({
        route: EvalExtractionDatasetsRoutes.presignFile,
        pathParams: { organizationId, projectId },
        body: { payload: { fileName: "dataset.csv", mimeType: "text/csv", size: 1024 } },
        token: accessToken,
      }),
    confirmFile: () =>
      request({
        route: EvalExtractionDatasetsRoutes.confirmFile,
        pathParams: { organizationId, projectId, documentId },
        token: accessToken,
      }),
    getFileColumns: () =>
      request({
        route: EvalExtractionDatasetsRoutes.getFileColumns,
        pathParams: { organizationId, projectId, documentId },
        token: accessToken,
      }),
    deleteFile: () =>
      request({
        route: EvalExtractionDatasetsRoutes.deleteFile,
        pathParams: { organizationId, projectId, documentId },
        token: accessToken,
      }),
    getAll: () =>
      request({
        route: EvalExtractionDatasetsRoutes.getAll,
        pathParams: { organizationId, projectId },
        token: accessToken,
      }),
    createOne: () =>
      request({
        route: EvalExtractionDatasetsRoutes.createOne,
        pathParams: { organizationId, projectId },
        body: { payload: { name: "Product records" } },
        token: accessToken,
      }),
    setUpOne: () =>
      request({
        route: EvalExtractionDatasetsRoutes.setUpOne,
        pathParams: { organizationId, projectId, datasetId, documentId },
        body: { payload: { name: "Product records", columns: SIMPLE_CSV_COLUMNS } },
        token: accessToken,
      }),
    renameOne: () =>
      request({
        route: EvalExtractionDatasetsRoutes.renameOne,
        pathParams: { organizationId, projectId, datasetId },
        body: { payload: { name: "Pricing records" } },
        token: accessToken,
      }),
    deleteOne: () =>
      request({
        route: EvalExtractionDatasetsRoutes.deleteOne,
        pathParams: { organizationId, projectId, datasetId },
        token: accessToken,
      }),
    getRecords: () =>
      request({
        route: EvalExtractionDatasetsRoutes.getRecords,
        pathParams: { organizationId, projectId, datasetId },
        query: { page: "0", limit: "100" },
        token: accessToken,
      }),
  }

  // `evaluation.extraction.dataset.*` on the project: only an evaluator of the project holds
  // them.
  describe.each(ROUTE_NAMES)("EvalExtractionDatasetsRoutes.%s", (routeName) => {
    const subject = () => subjects[routeName]()
    const { status } = ROUTE_CASES[routeName]

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for an organization id that is not a UUID", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      organizationId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 400 for a project id that is not a UUID", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      projectId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("requires an existing project of the organization", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("doesn't let a project member in", async () => {
      await createContextForRoles("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let a project admin who is not an evaluator in", async () => {
      await createContextForRoles("project_admin")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("doesn't let an organization admin outside the project in", async () => {
      const context = await createContextForRoles("project_owner", "project_evaluator")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("lets a project member who is an evaluator in", async () => {
      await createContextForRoles("project_member", "project_evaluator")
      expectResponse(await subject(), status)
    })
  })

  describe.each(
    DATASET_ROUTE_NAMES,
  )("EvalExtractionDatasetsRoutes.%s, its dataset", (routeName) => {
    const subject = () => subjects[routeName]()
    const { unknownDatasetStatus } = ROUTE_CASES[routeName]

    it("answers 400 for a dataset id that is not a UUID", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      datasetId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it(`answers ${unknownDatasetStatus} for an unknown dataset`, async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      datasetId = randomUUID()
      expectResponse(await subject(), unknownDatasetStatus)
    })

    it(`answers ${unknownDatasetStatus} for a dataset of another project`, async () => {
      const { organization } = await createContextForRoles("project_owner", "project_evaluator")
      const otherProject = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      const otherDataset = await repositories.evaluationExtractionDatasetRepository.save(
        evaluationExtractionDatasetFactory
          .transient({ organization, project: otherProject })
          .build(),
      )
      datasetId = otherDataset.id
      expectResponse(await subject(), unknownDatasetStatus)
    })
  })

  describe.each(FILE_ROUTE_NAMES)("EvalExtractionDatasetsRoutes.%s, its file", (routeName) => {
    const subject = () => subjects[routeName]()

    it("answers 400 for a file id that is not a UUID", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      documentId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    // The context resolver of the file answers 404, never 500.
    it("answers 404 for an unknown file", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      documentId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a file of another project", async () => {
      const { organization } = await createContextForRoles("project_owner", "project_evaluator")
      const otherProject = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      const otherDocument = await repositories.evaluationExtractionDatasetDocumentRepository.save(
        evaluationExtractionDatasetDocumentFactory
          .transient({ organization, project: otherProject })
          .build(),
      )
      documentId = otherDocument.id
      expectResponse(await subject(), 404)
    })
  })
})
