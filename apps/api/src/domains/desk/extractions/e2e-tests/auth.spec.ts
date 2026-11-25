import { randomUUID } from "node:crypto"
import { DeskAgentSessionsRoutes, DeskExtractionsRoutes } from "@bayes-platform/desk-contracts"
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
import { agentFactory } from "@/domains/agents/agent.factory"
import { extractionAgentSessionFactory } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.factory"
import { EXTRACTION_AGENT_SESSION_BATCH_SERVICE } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session-batch.interface"
import { documentFactory } from "@/domains/documents/document.factory"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithAgentSession,
} from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { userFactory } from "@/domains/users/user.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

type RouteName =
  | "getExtractionRuns"
  | "getOne"
  | "executeOne"
  | "deleteOne"
  | "presignDocument"
  | "confirmDocument"
  | "getMyDocuments"
  | "deleteMyDocument"

const ROUTE_NAMES: RouteName[] = [
  "getExtractionRuns",
  "getOne",
  "executeOne",
  "deleteOne",
  "presignDocument",
  "confirmDocument",
  "getMyDocuments",
  "deleteMyDocument",
]

/** The routes that name a run, and so resolve the `agentSession` context. */
const RUN_ROUTE_NAMES: RouteName[] = ["getOne", "deleteOne"]

/** The routes that name a document, and so resolve the `document` context. */
const DOCUMENT_ROUTE_NAMES: RouteName[] = ["deleteMyDocument"]

const mockFileStorageService = {
  getTemporaryUrl: jest.fn(),
  save: jest.fn(),
  readFile: jest.fn(),
  deleteFile: jest.fn(),
  generateSignedUploadUrl: jest.fn().mockResolvedValue("https://storage.example.com/upload"),
  buildStorageRelativePath: jest.fn(
    ({ documentId, extension }: { documentId: string; extension: string }) =>
      `org/project/${documentId}.${extension}`,
  ),
}

/** A batch service whose queue interactions are stubbed out (no Redis/BullMQ). */
const mockBatchService = {
  enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
}

describe("Desk extractions - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let agentId: string = randomUUID()
  let documentId: string = randomUUID()
  let agentSessionId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService)
          .overrideProvider(EXTRACTION_AGENT_SESSION_BATCH_SERVICE)
          .useValue(mockBatchService),
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
    agentSessionId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * Seeds a project (membership at `role`) with an extraction agent, and a run of `type` on a
   * document, both the caller's, so every route has a target. The document is the caller's
   * upload for a run, so executing it and confirming its upload are allowed.
   */
  const createContextForRole = async (
    role: ProjectRoleKey,
    type: "live" | "playground" = "live",
  ) => {
    const { organization, project, agent, agentSettings, document, agentSession, user } =
      await createOrganizationWithAgentSession({
        repositories,
        params: {
          user: { authSubject, email: mockOidcEmailForSub(authSubject) },
          projectMembership: { roleKeys: [role] },
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
    await repositories.documentRepository.update(
      { id: document!.id },
      { sourceType: "extraction", userId: user.id, uploadStatus: "pending" },
    )
    authSubject = user.authSubject!
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    documentId = document!.id
    return { organization, project, agent, agentSettings, document: document!, user, type }
  }

  /**
   * Switches the caller to an organization admin who holds no role on the project, and points the
   * path at a run of their own, so only the permission check stands in the way.
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
      membership: { roleKeys: ["org_admin"] },
    })
    const agentSession = await repositories.extractionAgentSessionRepository.save(
      extractionAgentSessionFactory
        .transient({ organization, project, agent, agentSettings, document, user })
        .build({ type }),
    )
    authSubject = organizationAdminAuthSubject
    agentSessionId = agentSession.id
  }

  const agentParams = () => ({ organizationId, projectId, agentId })
  const runParams = () => ({ ...agentParams(), agentSessionId })
  const documentParams = () => ({ ...agentParams(), documentId })

  const subjects: Record<RouteName, () => Promise<supertest.Response>> = {
    getExtractionRuns: () =>
      request({
        route: DeskAgentSessionsRoutes.getExtractionRuns,
        pathParams: agentParams(),
        token: accessToken,
      }),
    getOne: () =>
      request({
        route: DeskExtractionsRoutes.getOne,
        pathParams: runParams(),
        token: accessToken,
      }),
    executeOne: () =>
      request({
        route: DeskExtractionsRoutes.executeOne,
        pathParams: agentParams(),
        token: accessToken,
        body: { payload: { documentId } },
      }),
    deleteOne: () =>
      request({
        route: DeskExtractionsRoutes.deleteOne,
        pathParams: runParams(),
        token: accessToken,
      }),
    presignDocument: () =>
      request({
        route: DeskExtractionsRoutes.presignDocument,
        pathParams: agentParams(),
        token: accessToken,
        body: {
          payload: { file: { fileName: "invoice.pdf", mimeType: "application/pdf", size: 10 } },
        },
      }),
    confirmDocument: () =>
      request({
        route: DeskExtractionsRoutes.confirmDocument,
        pathParams: agentParams(),
        token: accessToken,
        body: { payload: { documentId } },
      }),
    getMyDocuments: () =>
      request({
        route: DeskExtractionsRoutes.getMyDocuments,
        pathParams: agentParams(),
        token: accessToken,
      }),
    deleteMyDocument: () =>
      request({
        route: DeskExtractionsRoutes.deleteMyDocument,
        pathParams: documentParams(),
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
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    // The live routes are open to every project role. Every route answers 201 (a POST).
    it.each<ProjectRoleKey>([
      "project_owner",
      "project_admin",
      "project_member",
    ])("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 201)
    })
  })

  describe.each(RUN_ROUTE_NAMES)("%s, on a run", (routeName) => {
    const subject = () => subjects[routeName]()

    it("answers 400 for a run id that is not a UUID", async () => {
      await createContextForRole("project_owner")
      agentSessionId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown run", async () => {
      await createContextForRole("project_owner")
      agentSessionId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a playground run", async () => {
      await createContextForRole("project_owner", "playground")
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a colleague's run", async () => {
      const { organization, project, agent, agentSettings, document } =
        await createContextForRole("project_owner")
      const colleague = await repositories.userRepository.save(userFactory.build())
      const colleagueRun = await repositories.extractionAgentSessionRepository.save(
        extractionAgentSessionFactory
          .transient({ organization, project, agent, agentSettings, document, user: colleague })
          .build({ type: "live" }),
      )
      agentSessionId = colleagueRun.id

      expectResponse(await subject(), 404)
      expect(
        await repositories.extractionAgentSessionRepository.count({
          where: { id: colleagueRun.id },
        }),
      ).toBe(1)
    })
  })

  describe.each(DOCUMENT_ROUTE_NAMES)("%s, on a document", (routeName) => {
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
  })

  describe("executeOne, on a document", () => {
    it("answers 404 for an unknown document", async () => {
      await createContextForRole("project_owner")
      documentId = randomUUID()
      expectResponse(await subjects.executeOne(), 404)
    })
  })

  describe("confirmDocument, on a document", () => {
    it("answers 404 for an unknown document", async () => {
      await createContextForRole("project_owner")
      documentId = randomUUID()
      expectResponse(await subjects.confirmDocument(), 404)
    })
  })

  it("answers 400 for a document id that is not a UUID in the body", async () => {
    await createContextForRole("project_owner")
    documentId = "not-a-uuid"
    expectResponse(await subjects.executeOne(), 400)
    expectResponse(await subjects.confirmDocument(), 400)
  })

  it("records the activity of an execution", async () => {
    await createContextForRole("project_member")
    expectResponse(await subjects.executeOne(), 201)
    await expectActivityCreated("extractionAgentSession.execute")
  })

  it("answers 404 when a member executes a colleague's document", async () => {
    const { organization, project } = await createContextForRole("project_member")
    const colleague = await repositories.userRepository.save(userFactory.build())
    const colleagueDocument = await repositories.documentRepository.save(
      documentFactory
        .transient({ organization, project })
        .build({ sourceType: "extraction", userId: colleague.id }),
    )
    documentId = colleagueDocument.id

    expectResponse(await subjects.executeOne(), 404)
    expect(await subjects.confirmDocument()).toMatchObject({ status: 404 })
    expect(await subjects.deleteMyDocument()).toMatchObject({ status: 404 })
    expect(mockBatchService.enqueueExecuteRun).not.toHaveBeenCalled()
  })

  it("answers 404 when a member executes a knowledge-base document of the project", async () => {
    // A run reads a file its caller uploaded for a run. The project's own documents sit behind
    // `document.read`, which a member does not hold, so they are absent here.
    const { organization, project } = await createContextForRole("project_member")
    const projectDocument = await repositories.documentRepository.save(
      documentFactory.transient({ organization, project }).build({ sourceType: "project" }),
    )
    documentId = projectDocument.id

    expectResponse(await subjects.executeOne(), 404)
    expect(await subjects.confirmDocument()).toMatchObject({ status: 404 })
    expect(mockBatchService.enqueueExecuteRun).not.toHaveBeenCalled()
    expect(await repositories.extractionAgentSessionRepository.count()).toBe(1)
  })

  // Accepting an invitation to one agent gives project_member on the project and agent_member on
  // that agent. The routes check the agent, so the other agents of the project stay closed.
  describe("a person invited to one agent", () => {
    const createInvitedAgentMemberContext = async () => {
      const { organization, project, agent, user } = await createOrganizationWithAgent(
        repositories,
        {
          user: { authSubject, email: mockOidcEmailForSub(authSubject) },
          organizationMembership: { roleKeys: ["org_member"] },
          projectMembership: { roleKeys: ["project_member"] },
          agentMembership: { roleKeys: ["agent_member"] },
          agent: { type: "extraction" },
        },
      )
      const otherAgent = await repositories.agentRepository.save(
        agentFactory.transient({ organization, project }).build({ type: "extraction" }),
      )
      authSubject = user.authSubject!
      organizationId = organization.id
      projectId = project.id
      return { agent, otherAgent }
    }

    it("can list the runs of their agent", async () => {
      const { agent } = await createInvitedAgentMemberContext()
      agentId = agent.id
      expectResponse(await subjects.getExtractionRuns(), 201)
    })

    it("cannot list the runs of another agent of the project", async () => {
      const { otherAgent } = await createInvitedAgentMemberContext()
      agentId = otherAgent.id
      expectResponse(await subjects.getExtractionRuns(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
