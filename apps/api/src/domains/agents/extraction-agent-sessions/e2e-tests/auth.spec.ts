import { randomUUID } from "node:crypto"
import {
  type BaseAgentSessionTypeDto,
  ExtractionAgentSessionsRoutes,
  MimeTypes,
  type ProjectMembershipRoleDto,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { extractionAgentSessionFactory } from "../extraction-agent-session.factory"
import { EXTRACTION_AGENT_SESSION_BATCH_SERVICE } from "../extraction-agent-session-batch.interface"
import { ExtractionAgentSessionsModule } from "../extraction-agent-sessions.module"

const mockLlmProvider = {
  streamChatResponse: jest.fn(),
  generateStructuredOutput: jest.fn().mockResolvedValue({ fullName: "Jane Doe" }),
}

const mockFileStorageService = {
  getTemporaryUrl: jest.fn().mockResolvedValue("https://example.com/fake-file.pdf"),
  save: jest.fn(),
  readFile: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

/** A batch service whose queue interactions are stubbed out (no Redis/BullMQ). */
const mockBatchService = {
  enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
}

describe("ExtractionAgentSessions - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let documentId: string = randomUUID()
  let agentSessionId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ExtractionAgentSessionsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider("_MockLLMProvider")
          .useValue(mockLlmProvider)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService)
          .overrideProvider(EXTRACTION_AGENT_SESSION_BATCH_SERVICE)
          .useValue(mockBatchService),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    agentId = randomUUID()
    documentId = randomUUID()
    agentSessionId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  // Seeds an organization/project (membership at `role`) + extraction agent, and a run of `type`
  // owned by the caller so the getOne and delete routes have a resolvable target.
  const createContextForRole = async (
    role: ProjectMembershipRoleDto,
    type: BaseAgentSessionTypeDto = "live",
  ) => {
    const { organization, project, agent, agentSettings, document, agentSession, user } =
      await createOrganizationWithAgentSession({
        repositories,
        params: {
          user: { authSubject, email: mockOidcEmailForSub(authSubject) },
          projectMembership: { role },
          agentSettings: {
            outputJsonSchema: {
              type: "object",
              properties: { fullName: { type: "string" } },
              required: ["fullName"],
            },
          },
          agentSession: { type },
        },
        agentType: "extraction",
      })
    authSubject = user.authSubject!
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    if (document) documentId = document.id
    return { organization, project, agent, agentSettings, document, type }
  }

  /**
   * Switches the caller to an organization admin who holds no role on the project, and points the
   * path at a run of their own, so only the permission check stands between them and the route.
   */
  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
    project,
    agent,
    agentSettings,
    document,
    type,
  }: Awaited<ReturnType<typeof createContextForRole>>) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    const { user } = await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { role: "admin" },
    })
    const agentSession = extractionAgentSessionFactory
      .transient({ organization, project, agent, agentSettings, document, user })
      .build({ type })
    await repositories.extractionAgentSessionRepository.save(agentSession)
    authSubject = organizationAdminAuthSubject
    agentSessionId = agentSession.id
  }

  // Shared by every route: authentication, organization and agent context.
  const describeContextChecks = (
    subject: (type: BaseAgentSessionTypeDto) => ReturnType<Requester>,
  ) => {
    describe.each([["live"], ["playground"]] as const)("on the %s routes", (type) => {
      it("requires an authentication token", async () => {
        accessToken = null
        expectResponse(await subject(type), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
      })

      it("requires a valid organization ID", async () => {
        await createContextForRole("owner", type)
        organizationId = null
        expectResponse(await subject(type), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
      })

      it("requires a valid agent ID", async () => {
        await createContextForRole("owner", type)
        agentId = randomUUID()
        expectResponse(await subject(type), 404)
      })

      it("requires the user to be a member of the organization", async () => {
        await createContextForRole("owner", type)
        authSubject = mockForeignAuthSubject()
        expectResponse(await subject(type), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
      })

      it("forbids an organization admin who holds no project role", async () => {
        const context = await createContextForRole("owner", type)
        await switchToOrganizationAdminWithoutProjectRole(context)
        expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      })
    })
  }

  // Live routes are open to every project role, playground routes to owners and admins only.
  // `allowedStatus` is what the handler answers once the caller is let through.
  const describeRoleChecks = (
    subject: (type: BaseAgentSessionTypeDto) => ReturnType<Requester>,
    allowedStatus = 201,
  ) => {
    it.each([
      ["owner"],
      ["admin"],
      ["member"],
    ] as const)("allows a project %s on the live routes", async (role) => {
      await createContextForRole(role, "live")
      expectResponse(await subject("live"), allowedStatus)
    })

    it.each([
      ["owner"],
      ["admin"],
    ] as const)("allows a project %s on the playground routes", async (role) => {
      await createContextForRole(role, "playground")
      expectResponse(await subject("playground"), allowedStatus)
    })

    it("forbids a plain member on the playground routes", async () => {
      await createContextForRole("member", "playground")
      expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  }

  describe("executeOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ExtractionAgentSessionsRoutes[type].executeOne,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: { payload: { documentId } },
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)
  })

  describe("getAll", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ExtractionAgentSessionsRoutes[type].getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)
  })

  describe("getOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ExtractionAgentSessionsRoutes[type].getOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)

    it("answers 404 for a playground run on the live routes", async () => {
      await createContextForRole("owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a live run on the playground routes", async () => {
      await createContextForRole("owner", "live")
      expectResponse(await subject("playground"), 404)
    })
  })

  describe("deleteOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ExtractionAgentSessionsRoutes[type].deleteOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)

    it("answers 404 for an unknown run", async () => {
      await createContextForRole("owner")
      agentSessionId = randomUUID()
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a playground run on the live routes", async () => {
      await createContextForRole("owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a live run on the playground routes", async () => {
      await createContextForRole("owner", "live")
      expectResponse(await subject("playground"), 404)
    })
  })

  describe("presignDocument", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ExtractionAgentSessionsRoutes[type].presignDocument,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: {
          payload: { file: { fileName: "invoice.pdf", mimeType: MimeTypes.pdf, size: 10 } },
        },
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)
  })

  describe("confirmDocument", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ExtractionAgentSessionsRoutes[type].confirmDocument,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: { payload: { documentId } },
      })

    describeContextChecks(subject)
    // The seeded document belongs to nobody, so a caller who is let through gets a 404.
    describeRoleChecks(subject, 404)
  })

  describe("listMyDocuments", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ExtractionAgentSessionsRoutes[type].listMyDocuments,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)
  })

  // An allowed caller would hold the stream open, so only the refusals are checked here.
  describe("streamSessionStatus", () => {
    const subject = async () =>
      request({
        route: ExtractionAgentSessionsRoutes.streamSessionStatus,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("member")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
