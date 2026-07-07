import { randomUUID } from "node:crypto"
import {
  ConversationAgentSessionsRoutes,
  type ProjectMembershipRoleDto,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
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
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import {
  mockAuth0EmailForSub,
  mockForeignAuth0Id,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ConversationAgentSessionsModule } from "../conversation-agent-sessions.module"

describe("Agent Sessions - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let agentSessionId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
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
    agentSessionId = randomUUID()
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContextForRole = async (role: ProjectMembershipRoleDto) => {
    const { organization, project, agent, agentSession, user } =
      await createOrganizationWithAgentSession({
        repositories,
        params: {
          user: { auth0Id, email: mockAuth0EmailForSub(auth0Id) },
          projectMembership: { role },
        },
        agentType: "conversation",
      })
    auth0Id = user.auth0Id
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    accessToken = "token"
  }

  describe("ConversationAgentSessionsRoutes.createOne", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: ConversationAgentSessionsRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: { payload: { type } },
      })

    describe.each([["live"], ["playground"]] as const)("creating a %s session", (type) => {
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
        await createContextForRole("member")
        agentId = null
        expectResponse(await subject(type), 404)
      })

      it("requires the user to be a member of the organization", async () => {
        await createContextForRole("member")
        auth0Id = mockForeignAuth0Id()
        expectResponse(await subject(type), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
      })

      if (type === "playground") {
        it("doesn't allow members to create playground sessions", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
        })
      } else {
        it("allows members to create live sessions", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 201)
        })
      }

      it("allows owners to create live sessions", async () => {
        await createContextForRole("owner")
        expectResponse(await subject(type), 201)
      })
    })
  })

  describe("ConversationAgentSessionsRoutes.getAll", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: ConversationAgentSessionsRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: { payload: { type } },
      })

    describe.each([["live"], ["playground"]] as const)("getting %s sessions", (type) => {
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
      if (type === "playground") {
        it("doesn't allow simple member to get playground sessions", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
        })
      } else {
        it("allows members to get live sessions", async () => {
          await createContextForRole("member")
          expectResponse(await subject(type), 201)
        })
      }
      it("allows owner to get sessions", async () => {
        await createContextForRole("owner")
        expectResponse(await subject(type), 201)
      })
      it("requires the user to be a member of the organization", async () => {
        await createContextForRole("owner")
        auth0Id = mockForeignAuth0Id()
        expectResponse(await subject(type), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
      })
    })
  })

  describe("ConversationAgentSessionsRoutes.deleteOne", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: ConversationAgentSessionsRoutes.deleteOne,
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
