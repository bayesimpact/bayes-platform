import { randomUUID } from "node:crypto"
import {
  AgentCsvExtractionRunsRoutes,
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
import { mockForeignAuth0Id } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import { createCsvExtractionRun, createCsvExtractionRunContext } from "./csv-extraction-run.helpers"
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
  let accessToken: string | null = "token"
  let auth0Id = `auth0|${randomUUID()}`

  const mockBatchService = buildMockBatchService()
  const mockFileStorageService = buildMockFileStorageService()

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [AgentCsvExtractionRunsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => auth0Id, {
          batchService: mockBatchService,
          fileStorageService: mockFileStorageService,
        }),
    })
    repositories = setup.getAllRepositories()
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
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  // Seeds an organization/project (membership at `role`) + agent + CSV document,
  // and a "running" run so update/delete/read routes have a resolvable target.
  const createContextForRole = async (role: ProjectMembershipRoleDto) => {
    const context = await createCsvExtractionRunContext({ repositories, role, auth0Id })
    const run = await createCsvExtractionRun({ repositories, context, status: "running" })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    documentId = context.csvDocument.id
    agentCsvExtractionRunId = run.id
  }

  describe("createOne", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.createOne,
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
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("allows a project member to create a run", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 201)
    })
  })

  describe("executeOne", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.executeOne,
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
      auth0Id = mockForeignAuth0Id()
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
  })

  describe("retryOne", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.retryOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
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
  })

  describe("cancelOne", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.cancelOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
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
  })

  describe("getOne", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.getOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
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
  })

  describe("getAll", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.getAll,
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
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("allows a project member to list runs", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 200)
    })
  })

  describe("getRecords", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.getRecords,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
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
  })

  describe("deleteOne", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
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
  })

  describe("getFileColumns", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.getFileColumns,
        pathParams: removeNullish({ organizationId, projectId, agentId, documentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("allows a project member to read file columns", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 200)
    })
  })

  describe("streamRunStatus", () => {
    const subject = async () =>
      request({
        route: AgentCsvExtractionRunsRoutes.streamRunStatus,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
  })
})
