import { randomUUID } from "node:crypto"
import { EvalConversationDatasetsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { evaluationConversationDatasetFactory } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.factory"
import { evaluationConversationDatasetRecordFactory } from "@/domains/evaluations/conversation/datasets/records/evaluation-conversation-dataset-record.factory"
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

type RouteName = keyof typeof EvalConversationDatasetsRoutes

type RouteCase = {
  /** The status of an allowed call. */
  status: number
  /** The route names a dataset in its path. */
  hasDataset: boolean
  /** The route names a record in its path. */
  hasRecord: boolean
  /**
   * What an unknown dataset answers: a 404 from the context resolver (`@AddContext` today) or
   * from the service, and an empty page for `getRecords`, which reads by project and dataset id.
   */
  unknownDatasetStatus: number
}

const ROUTE_CASES: Record<RouteName, RouteCase> = {
  getAll: { status: 200, hasDataset: false, hasRecord: false, unknownDatasetStatus: 200 },
  createOne: { status: 201, hasDataset: false, hasRecord: false, unknownDatasetStatus: 201 },
  renameOne: { status: 200, hasDataset: true, hasRecord: false, unknownDatasetStatus: 404 },
  deleteOne: { status: 200, hasDataset: true, hasRecord: false, unknownDatasetStatus: 404 },
  getRecords: { status: 200, hasDataset: true, hasRecord: false, unknownDatasetStatus: 200 },
  createRecord: { status: 201, hasDataset: true, hasRecord: false, unknownDatasetStatus: 404 },
  createRecords: { status: 201, hasDataset: true, hasRecord: false, unknownDatasetStatus: 404 },
  updateRecord: { status: 200, hasDataset: true, hasRecord: true, unknownDatasetStatus: 404 },
  deleteRecord: { status: 200, hasDataset: true, hasRecord: true, unknownDatasetStatus: 404 },
}

const ROUTE_NAMES = Object.keys(ROUTE_CASES) as RouteName[]

const DATASET_ROUTE_NAMES = ROUTE_NAMES.filter((routeName) => ROUTE_CASES[routeName].hasDataset)

const RECORD_ROUTE_NAMES = ROUTE_NAMES.filter((routeName) => ROUTE_CASES[routeName].hasRecord)

describe("Evaluation conversation datasets - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let datasetId: string = randomUUID()
  let recordId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
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
    recordId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A project with a dataset that holds one record, and a caller with the given project roles. */
  const createContextForRoles = async (...roleKeys: ProjectRoleKey[]) => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      projectMembership: { roleKeys },
    })
    const dataset = await repositories.evaluationConversationDatasetRepository.save(
      evaluationConversationDatasetFactory.transient({ organization, project }).build(),
    )
    const record = await repositories.evaluationConversationDatasetRecordRepository.save(
      evaluationConversationDatasetRecordFactory
        .transient({ organization, project, evaluationConversationDataset: dataset })
        .build(),
    )
    organizationId = organization.id
    projectId = project.id
    datasetId = dataset.id
    recordId = record.id
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

  const recordInput = { input: "Sample question", expectedOutput: "Sample expected answer" }

  const subjects: Record<RouteName, () => ReturnType<SchemaRequester>> = {
    getAll: () =>
      request({
        route: EvalConversationDatasetsRoutes.getAll,
        pathParams: { organizationId, projectId },
        token: accessToken,
      }),
    createOne: () =>
      request({
        route: EvalConversationDatasetsRoutes.createOne,
        pathParams: { organizationId, projectId },
        body: { payload: { name: "Product questions" } },
        token: accessToken,
      }),
    renameOne: () =>
      request({
        route: EvalConversationDatasetsRoutes.renameOne,
        pathParams: { organizationId, projectId, datasetId },
        body: { payload: { name: "Pricing questions" } },
        token: accessToken,
      }),
    deleteOne: () =>
      request({
        route: EvalConversationDatasetsRoutes.deleteOne,
        pathParams: { organizationId, projectId, datasetId },
        token: accessToken,
      }),
    getRecords: () =>
      request({
        route: EvalConversationDatasetsRoutes.getRecords,
        pathParams: { organizationId, projectId, datasetId },
        query: { page: "0", limit: "100" },
        token: accessToken,
      }),
    createRecord: () =>
      request({
        route: EvalConversationDatasetsRoutes.createRecord,
        pathParams: { organizationId, projectId, datasetId },
        body: { payload: recordInput },
        token: accessToken,
      }),
    createRecords: () =>
      request({
        route: EvalConversationDatasetsRoutes.createRecords,
        pathParams: { organizationId, projectId, datasetId },
        body: { payload: { records: [recordInput] } },
        token: accessToken,
      }),
    updateRecord: () =>
      request({
        route: EvalConversationDatasetsRoutes.updateRecord,
        pathParams: { organizationId, projectId, datasetId, recordId },
        body: { payload: recordInput },
        token: accessToken,
      }),
    deleteRecord: () =>
      request({
        route: EvalConversationDatasetsRoutes.deleteRecord,
        pathParams: { organizationId, projectId, datasetId, recordId },
        token: accessToken,
      }),
  }

  // `evaluation.conversation.dataset.*` on the project: only an evaluator of the project holds
  // them.
  describe.each(ROUTE_NAMES)("EvalConversationDatasetsRoutes.%s", (routeName) => {
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
  )("EvalConversationDatasetsRoutes.%s, its dataset", (routeName) => {
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
      const otherDataset = await repositories.evaluationConversationDatasetRepository.save(
        evaluationConversationDatasetFactory
          .transient({ organization, project: otherProject })
          .build(),
      )
      datasetId = otherDataset.id
      expectResponse(await subject(), unknownDatasetStatus)
    })
  })

  describe.each(
    RECORD_ROUTE_NAMES,
  )("EvalConversationDatasetsRoutes.%s, its record", (routeName) => {
    const subject = () => subjects[routeName]()

    it("answers 400 for a record id that is not a UUID", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      recordId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown record", async () => {
      await createContextForRoles("project_owner", "project_evaluator")
      recordId = randomUUID()
      expectResponse(await subject(), 404)
    })
  })
})
