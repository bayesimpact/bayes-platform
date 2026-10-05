import { randomUUID } from "node:crypto"
import {
  AgentCsvExtractionRunsRoutes,
  type BaseAgentSessionTypeDto,
  type ProjectMembershipRoleDto,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { mockForeignAuthSubject, mockOidcEmailForSub } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import {
  createCsvExtractionRun,
  createCsvExtractionRunContext,
  createOtherAgentInProject,
} from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let documentId: string = randomUUID()
  let agentCsvExtractionRunId: string | null = randomUUID()
  let runType: BaseAgentSessionTypeDto = "live"
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  const mockBatchService = buildMockBatchService()
  const mockFileStorageService = buildMockFileStorageService()

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [AgentCsvExtractionRunsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => authSubject, {
          batchService: mockBatchService,
          fileStorageService: mockFileStorageService,
        }),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
    organizationId = randomUUID()
    projectId = randomUUID()
    agentId = randomUUID()
    documentId = randomUUID()
    agentCsvExtractionRunId = randomUUID()
    runType = "live"
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  // Seeds an organization/project (membership at `role`) + agent + CSV document,
  // and a "running" run so update/delete/read routes have a resolvable target. The subjects call
  // the route set of that run's type unless told otherwise.
  const createContextForRole = async (
    role: ProjectMembershipRoleDto,
    type: BaseAgentSessionTypeDto = "live",
  ) => {
    const context = await createCsvExtractionRunContext({ repositories, role, authSubject })
    const run = await createCsvExtractionRun({ repositories, context, status: "running", type })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    documentId = context.csvDocument.id
    agentCsvExtractionRunId = run.id
    runType = type
    return context
  }

  /** Points the path at another agent of the same project, so the seeded run is not that agent's. */
  const switchToOtherAgentOfProject = async (
    context: Awaited<ReturnType<typeof createContextForRole>>,
  ) => {
    const { agent } = await createOtherAgentInProject({ repositories, context })
    agentId = agent.id
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
      membership: { role: "admin" },
    })
    authSubject = organizationAdminAuthSubject
  }

  describe("createOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].createOne,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: { payload: { csvDocumentId: documentId, columnSchema: {} } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("allows a project member to create a run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 201)
    })

    it("forbids a plain member to create a playground run", async () => {
      // Playground runs mirror agent sessions: they belong to the Studio surface, which only
      // project admins and owners operate.
      await createContextForRole("member")
      expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows a project admin to create a playground run", async () => {
      await createContextForRole("admin")
      expectResponse(await subject("playground"), 201)
    })

    it("doesn't allow an organization admin without a project role to create a run", async () => {
      const { organization } = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("executeOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].executeOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
        request: { payload: { recordLimit: null } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("returns 404 for an unknown run", async () => {
      await createContextForRole("owner")
      agentCsvExtractionRunId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("allows a project member to execute a run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 201)
    })

    it("forbids a plain member to execute a playground run", async () => {
      await createContextForRole("member", "playground")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows a project admin to execute a playground run", async () => {
      await createContextForRole("admin", "playground")
      expectResponse(await subject(), 201)
    })

    it("answers 404 for a playground run on the live routes", async () => {
      await createContextForRole("owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a run of another agent of the project", async () => {
      const context = await createContextForRole("owner")
      await switchToOtherAgentOfProject(context)
      expectResponse(await subject(), 404)
    })
  })

  describe("retryOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].retryOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("returns 404 for an unknown run", async () => {
      await createContextForRole("owner")
      agentCsvExtractionRunId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("allows a project member to retry a run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 201)
    })

    it("forbids a plain member to retry a playground run", async () => {
      await createContextForRole("member", "playground")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows a project admin to retry a playground run", async () => {
      await createContextForRole("admin", "playground")
      expectResponse(await subject(), 201)
    })

    it("answers 404 for a playground run on the live routes", async () => {
      await createContextForRole("owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a run of another agent of the project", async () => {
      const context = await createContextForRole("owner")
      await switchToOtherAgentOfProject(context)
      expectResponse(await subject(), 404)
    })
  })

  describe("cancelOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].cancelOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("returns 404 for an unknown run", async () => {
      await createContextForRole("owner")
      agentCsvExtractionRunId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("allows a project member to cancel a run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 201)
    })

    it("forbids a plain member to cancel a playground run", async () => {
      await createContextForRole("member", "playground")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows a project admin to cancel a playground run", async () => {
      await createContextForRole("admin", "playground")
      expectResponse(await subject(), 201)
    })

    it("answers 404 for a playground run on the live routes", async () => {
      await createContextForRole("owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a run of another agent of the project", async () => {
      const context = await createContextForRole("owner")
      await switchToOtherAgentOfProject(context)
      expectResponse(await subject(), 404)
    })
  })

  describe("getOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].getOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("returns 404 for an unknown run", async () => {
      await createContextForRole("owner")
      agentCsvExtractionRunId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("allows a project member to read a run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 200)
    })

    it("forbids a plain member to read a playground run", async () => {
      await createContextForRole("member", "playground")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows a project admin to read a playground run", async () => {
      await createContextForRole("admin", "playground")
      expectResponse(await subject(), 200)
    })

    it("answers 404 for a playground run on the live routes", async () => {
      await createContextForRole("owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a run of another agent of the project", async () => {
      const context = await createContextForRole("owner")
      await switchToOtherAgentOfProject(context)
      expectResponse(await subject(), 404)
    })

    it("doesn't allow an organization admin without a project role to read a run", async () => {
      const { organization } = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(organization)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("getAll", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires a valid organization ID", async () => {
      await createContextForRole("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("allows a project member to list runs", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 200)
    })

    it("forbids a plain member to list playground runs", async () => {
      await createContextForRole("member")
      expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows a project admin to list playground runs", async () => {
      await createContextForRole("admin")
      expectResponse(await subject("playground"), 200)
    })
  })

  describe("getRecords", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].getRecords,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("returns 404 for an unknown run", async () => {
      await createContextForRole("owner")
      agentCsvExtractionRunId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("allows a project member to list records", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 200)
    })

    it("forbids a plain member to list the records of a playground run", async () => {
      await createContextForRole("member", "playground")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("answers 404 for a playground run on the live routes", async () => {
      await createContextForRole("owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a run of another agent of the project", async () => {
      const context = await createContextForRole("owner")
      await switchToOtherAgentOfProject(context)
      expectResponse(await subject(), 404)
    })
  })

  describe("deleteOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].deleteOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("returns 404 for an unknown run", async () => {
      await createContextForRole("owner")
      agentCsvExtractionRunId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("allows a project member to delete a run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 200)
    })

    it("forbids a plain member to delete a playground run", async () => {
      await createContextForRole("member", "playground")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows a project admin to delete a playground run", async () => {
      await createContextForRole("admin", "playground")
      expectResponse(await subject(), 200)
    })

    it("answers 404 for a playground run on the live routes", async () => {
      await createContextForRole("owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a run of another agent of the project", async () => {
      const context = await createContextForRole("owner")
      await switchToOtherAgentOfProject(context)
      expectResponse(await subject(), 404)
    })
  })

  describe("getFileColumns", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].getFileColumns,
        pathParams: removeNullish({ organizationId, projectId, agentId, documentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("allows a project member to read file columns", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 200)
    })

    it("forbids a plain member to read file columns on the playground routes", async () => {
      await createContextForRole("member")
      expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("streamRunStatus", () => {
    const subject = async (type: BaseAgentSessionTypeDto = runType) =>
      request({
        route: AgentCsvExtractionRunsRoutes[type].streamRunStatus,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("forbids a plain member to stream playground run statuses", async () => {
      await createContextForRole("member")
      expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
