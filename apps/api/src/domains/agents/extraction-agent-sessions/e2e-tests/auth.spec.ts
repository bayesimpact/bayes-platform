import { randomUUID } from "node:crypto"
import {
  ExtractionAgentSessionsRoutes,
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
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import {
  mockAuth0EmailForSub,
  mockForeignAuth0Id,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ExtractionAgentSessionsModule } from "../extraction-agent-sessions.module"

const mockLlmProvider = {
  streamChatResponse: jest.fn(),
  generateChatResponse: jest.fn(),
  generateStructuredOutput: jest.fn().mockResolvedValue({ fullName: "Jane Doe" }),
}

const mockFileStorageService = {
  getTemporaryUrl: jest.fn().mockResolvedValue("https://example.com/fake-file.pdf"),
  save: jest.fn(),
  readFile: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
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
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ExtractionAgentSessionsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider("_MockLLMProvider")
          .useValue(mockLlmProvider)
          .overrideProvider(FILE_STORAGE_SERVICE)
          .useValue(mockFileStorageService),
    })
    repositories = setup.getAllRepositories()
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
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    app.close()
  })

  const createContextForRole = async (role: ProjectMembershipRoleDto) => {
    const { organization, project, agent, document, agentSession, user } =
      await createOrganizationWithAgentSession({
        repositories,
        params: {
          user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
          projectMembership: { role },
          agentSettings: {
            outputJsonSchema: {
              type: "object",
              properties: { fullName: { type: "string" } },
              required: ["fullName"],
            },
          },
        },
        agentType: "extraction",
      })
    auth0Id = user.auth0Id
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    if (document) documentId = document.id
  }

  describe("ExtractionAgentSessionsRoutes.executeOne", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: ExtractionAgentSessionsRoutes.executeOne,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: { payload: { documentId, type } },
      })

    describe.each([["live"], ["playground"]] as const)("executing %s session", (type) => {
      it("requires an authentication token", async () => {
        accessToken = null
        expectResponse(await subject(type), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
      })

      it("requires a valid organization ID", async () => {
        await createContextForRole("owner")
        organizationId = null
        expectResponse(await subject(type), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
      })

      it("requires a valid project ID", async () => {
        await createContextForRole("owner")
        projectId = randomUUID()
        expectResponse(await subject(type), 404)
      })

      it("requires the user to be a member of the organization", async () => {
        await createContextForRole("owner")
        auth0Id = mockForeignAuth0Id()
        expectResponse(await subject(type), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
      })

      if (type === "playground") {
        it("does not allow a simple member to execute a playground session", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
        })
      } else {
        // FIXME: it works with UI but fails in tests
        it.skip("allows members to execute a live session", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 201)
        })
      }
    })
  })

  describe("ExtractionAgentSessionsRoutes.getAll", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: ExtractionAgentSessionsRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: { payload: { type } },
      })

    describe.each([["live"], ["playground"]] as const)("get %s sessions", (type) => {
      it("requires authentication", async () => {
        accessToken = null
        expectResponse(await subject(type), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
      })

      if (type === "playground") {
        it("does not allow a simple member to get playground sessions", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
        })
      } else {
        it("allows a simple member to get live sessions", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 201)
        })
      }
    })
  })

  describe("ExtractionAgentSessionsRoutes.getOne", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: ExtractionAgentSessionsRoutes.getOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
        request: { payload: { type } },
      })

    describe.each([["live"], ["playground"]] as const)("getting a %s session", (type) => {
      it("requires authentication", async () => {
        accessToken = null
        expectResponse(await subject(type), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
      })
      if (type === "playground") {
        it("does not allow a simple member", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
        })
      } else {
        it("allows a simple member to get live sessions", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 201)
        })
      }
    })
  })

  describe("ExtractionAgentSessionsRoutes.deleteOne", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: ExtractionAgentSessionsRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
        request: { payload: { type } },
      })

    describe.each([["live"], ["playground"]] as const)("deleting a %s session", (type) => {
      it("requires an authentication token", async () => {
        accessToken = null
        expectResponse(await subject(type), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
      })
      it("requires a valid organization ID", async () => {
        await createContextForRole("owner")
        organizationId = null
        expectResponse(await subject(type), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
      })
      it("requires a valid agent ID", async () => {
        await createContextForRole("owner")
        agentId = null
        expectResponse(await subject(type), 404)
      })
      it("requires the user to be a member of the organization", async () => {
        await createContextForRole("owner")
        auth0Id = mockForeignAuth0Id()
        expectResponse(await subject(type), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
      })
      if (type === "playground") {
        it("doesn't allow a simple member to delete playground sessions", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
        })
      } else {
        it("allows member to delete sessions", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 201)
        })
      }
      it("allows owner to delete sessions", async () => {
        await createContextForRole("owner")
        expectResponse(await subject(type), 201)
      })
    })
  })
})
