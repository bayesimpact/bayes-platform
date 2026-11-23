import { randomUUID } from "node:crypto"
import { DeskAgentSessionsRoutes, DeskCsvExtractionsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type supertest from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  attachCsvExtractionRunExport,
  createCsvDocumentNotOwnedByUser,
  createCsvExtractionRun,
  createCsvExtractionRunContext,
  createOtherAgentInProject,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/setup"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { userFactory } from "@/domains/users/user.factory"
import { mockForeignAuthSubject, mockOidcEmailForSub } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

type RouteName =
  | "getCsvExtractionRuns"
  | "getFileColumns"
  | "createOne"
  | "executeOne"
  | "getOne"
  | "getRecords"
  | "cancelOne"
  | "retryOne"
  | "getExportTemporaryUrl"
  | "deleteOne"

/** Every route of the area, with the status it answers an allowed caller. */
const ALLOWED_STATUS: Record<RouteName, number> = {
  getCsvExtractionRuns: 200,
  getFileColumns: 200,
  createOne: 201,
  executeOne: 201,
  getOne: 200,
  getRecords: 200,
  cancelOne: 201,
  retryOne: 201,
  getExportTemporaryUrl: 200,
  deleteOne: 200,
}

const ROUTE_NAMES = Object.keys(ALLOWED_STATUS) as RouteName[]

/** The routes that name a run, and so resolve the `agentCsvExtractionRun` context. */
const RUN_ROUTE_NAMES: RouteName[] = [
  "executeOne",
  "getOne",
  "getRecords",
  "cancelOne",
  "retryOne",
  "getExportTemporaryUrl",
  "deleteOne",
]

/** The routes that read a CSV the caller uploaded. */
const CSV_DOCUMENT_ROUTE_NAMES: RouteName[] = ["getFileColumns", "createOne"]

const CSV_DOCUMENTS_NOT_OWNED_BY_USER = [
  "knowledge_base",
  "colleague_upload",
  "other_organization",
] as const

describe("Desk CSV extractions - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let agentId: string = randomUUID()
  let documentId: string = randomUUID()
  let agentCsvExtractionRunId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  const mockBatchService = buildMockBatchService()
  const mockFileStorageService = buildMockFileStorageService()

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => authSubject, {
          batchService: mockBatchService,
          fileStorageService: mockFileStorageService,
        }),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
    organizationId = randomUUID()
    projectId = randomUUID()
    agentId = randomUUID()
    documentId = randomUUID()
    agentCsvExtractionRunId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * Seeds a project (membership at `role`) with an extraction agent, a CSV the caller uploaded,
   * and a running run of `type` with its export, so every route has a target.
   */
  const createContextForRole = async (
    role: ProjectRoleKey,
    type: "live" | "playground" = "live",
  ) => {
    const context = await createCsvExtractionRunContext({ repositories, role, authSubject })
    const run = await createCsvExtractionRun({ repositories, context, status: "running", type })
    await attachCsvExtractionRunExport({ repositories, context, run })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    documentId = context.csvDocument.id
    agentCsvExtractionRunId = run.id
    return context
  }

  /**
   * Points the path at a run of the same agent with its export, created by a colleague, or by
   * nobody (`null`, a run created before ownership was tracked).
   */
  const switchToRunCreatedBy = async (
    creator: "colleague" | null,
    context: Awaited<ReturnType<typeof createContextForRole>>,
  ) => {
    const user =
      creator === "colleague" ? await repositories.userRepository.save(userFactory.build()) : null
    const run = await createCsvExtractionRun({ repositories, context, status: "running", user })
    await attachCsvExtractionRunExport({ repositories, context, run })
    agentCsvExtractionRunId = run.id
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async (
    organization: Awaited<ReturnType<typeof createContextForRole>>["organization"],
  ) => {
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

  const agentParams = () => ({ organizationId, projectId, agentId })
  const runParams = () => ({ ...agentParams(), agentCsvExtractionRunId })

  const subjects: Record<RouteName, () => Promise<supertest.Response>> = {
    getCsvExtractionRuns: () =>
      request({
        route: DeskAgentSessionsRoutes.getCsvExtractionRuns,
        pathParams: agentParams(),
        token: accessToken,
      }),
    getFileColumns: () =>
      request({
        route: DeskCsvExtractionsRoutes.getFileColumns,
        pathParams: { ...agentParams(), documentId },
        token: accessToken,
      }),
    createOne: () =>
      request({
        route: DeskCsvExtractionsRoutes.createOne,
        pathParams: agentParams(),
        token: accessToken,
        body: { payload: { csvDocumentId: documentId, columnSchema: {} } },
      }),
    executeOne: () =>
      request({
        route: DeskCsvExtractionsRoutes.executeOne,
        pathParams: runParams(),
        token: accessToken,
        body: { payload: { recordLimit: null } },
      }),
    getOne: () =>
      request({
        route: DeskCsvExtractionsRoutes.getOne,
        pathParams: runParams(),
        token: accessToken,
      }),
    getRecords: () =>
      request({
        route: DeskCsvExtractionsRoutes.getRecords,
        pathParams: runParams(),
        token: accessToken,
        query: { page: "0", limit: "10" },
      }),
    cancelOne: () =>
      request({
        route: DeskCsvExtractionsRoutes.cancelOne,
        pathParams: runParams(),
        token: accessToken,
      }),
    retryOne: () =>
      request({
        route: DeskCsvExtractionsRoutes.retryOne,
        pathParams: runParams(),
        token: accessToken,
      }),
    getExportTemporaryUrl: () =>
      request({
        route: DeskCsvExtractionsRoutes.getExportTemporaryUrl,
        pathParams: runParams(),
        token: accessToken,
      }),
    deleteOne: () =>
      request({
        route: DeskCsvExtractionsRoutes.deleteOne,
        pathParams: runParams(),
        token: accessToken,
      }),
  }

  describe.each(ROUTE_NAMES)("%s", (routeName) => {
    const subject = () => subjects[routeName]()

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for an agent id that is not a UUID", async () => {
      await createContextForRole("project_owner")
      agentId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown agent", async () => {
      await createContextForRole("project_owner")
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("forbids an organization admin who holds no project role", async () => {
      const { organization } = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("forbids a project member on another agent of the project, where they hold no role", async () => {
      const context = await createContextForRole("project_member")
      const { agent } = await createOtherAgentInProject({ repositories, context })
      agentId = agent.id
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    // The live routes are open to every project role.
    it.each<ProjectRoleKey>([
      "project_owner",
      "project_admin",
      "project_member",
    ])("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), ALLOWED_STATUS[routeName])
    })
  })

  describe.each(RUN_ROUTE_NAMES)("%s, on a run", (routeName) => {
    const subject = () => subjects[routeName]()

    it("answers 400 for a run id that is not a UUID", async () => {
      await createContextForRole("project_owner")
      agentCsvExtractionRunId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown run", async () => {
      await createContextForRole("project_owner")
      agentCsvExtractionRunId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a playground run", async () => {
      await createContextForRole("project_owner", "playground")
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a run of another agent of the project", async () => {
      const context = await createContextForRole("project_owner")
      const { agent } = await createOtherAgentInProject({ repositories, context })
      agentId = agent.id
      expectResponse(await subject(), 404)
    })

    it.each<ProjectRoleKey>([
      "project_member",
      "project_owner",
    ])("answers 404 for a colleague's run to a %s", async (role) => {
      const context = await createContextForRole(role)
      await switchToRunCreatedBy("colleague", context)
      expectResponse(await subject(), 404)
      expect(
        await repositories.agentCsvExtractionRunRepository.count({
          where: { id: agentCsvExtractionRunId },
        }),
      ).toBe(1)
    })

    it("allows a project member on a run created before ownership was tracked", async () => {
      const context = await createContextForRole("project_member")
      await switchToRunCreatedBy(null, context)
      expectResponse(await subject(), ALLOWED_STATUS[routeName])
    })
  })

  describe.each(CSV_DOCUMENT_ROUTE_NAMES)("%s, on a CSV", (routeName) => {
    const subject = () => subjects[routeName]()

    it("answers 400 for a document id that is not a UUID", async () => {
      await createContextForRole("project_owner")
      documentId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown document", async () => {
      await createContextForRole("project_owner")
      documentId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it.each(
      CSV_DOCUMENTS_NOT_OWNED_BY_USER,
    )("answers 404 to a project owner on a CSV they did not upload (%s)", async (origin) => {
      const context = await createContextForRole("project_owner")
      const document = await createCsvDocumentNotOwnedByUser({ repositories, context, origin })
      documentId = document.id
      expectResponse(await subject(), 404)
      expect(mockFileStorageService.createReadStream).not.toHaveBeenCalled()
      expect(await repositories.agentCsvExtractionRunRepository.count()).toBe(1)
    })
  })

  it("records the activity of a run creation", async () => {
    await createContextForRole("project_member")
    expectResponse(await subjects.createOne(), 201)
    await expectActivityCreated("agentCsvExtractionRun.create")
  })
})
