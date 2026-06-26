import { randomUUID } from "node:crypto"
import {
  FormAgentSessionsRoutes,
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
import { mockForeignAuth0Id, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { FormAgentSessionsModule } from "../form-agent-sessions.module"

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
      additionalImports: [FormAgentSessionsModule],
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
    const { organization, project, agent, agentSession } = await createOrganizationWithAgentSession(
      {
        repositories,
        params: {
          user: { auth0Id },
          projectMembership: { role },
        },
        agentType: "form",
      },
    )
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    accessToken = "token"
  }

  describe("FormAgentSessionsRoutes.createOne", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: FormAgentSessionsRoutes.createOne,
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

  describe("FormAgentSessionsRoutes.getAll", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: FormAgentSessionsRoutes.getAll,
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

  describe("FormAgentSessionsRoutes.listSubSessions", () => {
    // Sub-sessions are listed for a parent conversation agent, the only agent
    // type allowed to have sub-agents.
    const createConversationContextForRole = async (role: ProjectMembershipRoleDto) => {
      const { organization, project, agent, agentSession } =
        await createOrganizationWithAgentSession({
          repositories,
          params: {
            user: { auth0Id },
            projectMembership: { role },
          },
          agentType: "conversation",
        })
      organizationId = organization.id
      projectId = project.id
      agentId = agent.id
      agentSessionId = agentSession.id
      accessToken = "token"
    }

    const subject = async (type: "playground" | "live") =>
      request({
        route: FormAgentSessionsRoutes.listSubSessions,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
        request: { payload: { type } },
      })

    describe.each([["live"], ["playground"]] as const)("listing %s sub-sessions", (type) => {
      it("requires an authentication token", async () => {
        accessToken = null
        expectResponse(await subject(type), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
      })
      it("requires a valid organization ID", async () => {
        await createConversationContextForRole("owner")
        organizationId = null
        expectResponse(await subject(type), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
      })
      it("requires a valid agent ID", async () => {
        await createConversationContextForRole("owner")
        agentId = null
        expectResponse(await subject(type), 404)
      })
      it("requires the user to be a member of the organization", async () => {
        await createConversationContextForRole("owner")
        auth0Id = mockForeignAuth0Id()
        expectResponse(await subject(type), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
      })
      if (type === "playground") {
        it("doesn't allow a simple member to list playground sub-sessions", async () => {
          await createConversationContextForRole("member")
          expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
        })
      } else {
        it("allows members to list live sub-sessions", async () => {
          await createConversationContextForRole("member")
          expectResponse(await subject(type), 201)
        })
      }
      it("allows owner to list sub-sessions", async () => {
        await createConversationContextForRole("owner")
        expectResponse(await subject(type), 201)
      })
    })
  })

  describe("FormAgentSessionsRoutes.deleteOne", () => {
    const subject = async (type: "playground" | "live") =>
      request({
        route: FormAgentSessionsRoutes.deleteOne,
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
