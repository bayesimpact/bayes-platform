import { randomUUID } from "node:crypto"
import { AgentMessageFeedbackRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithAgentMessage } from "@/domains/organizations/organization.factory"
import { mockForeignAuth0Id, setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../../test/request"
import { AgentMessageFeedbackModule } from "../agent-message-feedback.module"

describe("Agent Message Feedback - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let agentMessageId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentMessageFeedbackModule],
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
    agentMessageId = randomUUID()
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: "owner" | "admin" | "member" = "owner") => {
    const { organization, project, agent, agentMessage } = await createOrganizationWithAgentMessage(
      {
        repositories,
        params: {
          user: { auth0Id },
          organizationMembership: { role: "member" },
          projectMembership: { role },
          agentMembership: { role: "member" },
        },
        agentType: "conversation",
      },
    )
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentMessageId = agentMessage.id
    accessToken = "token"
    return { organization, project }
  }

  describe("AgentMessageFeedbackRoutes.createOne", () => {
    const subject = async (payload?: typeof AgentMessageFeedbackRoutes.createOne.request) =>
      request({
        route: AgentMessageFeedbackRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId, agentMessageId }),
        token: accessToken ?? undefined,
        request: payload,
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
    it("requires a valid project ID", async () => {
      await createContextForRole("member")
      projectId = null // reset to a non-null value
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("member")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
  })

  describe("AgentMessageFeedbackRoutes.getAll", () => {
    const subject = async (payload?: typeof AgentMessageFeedbackRoutes.getAll.request) =>
      request({
        route: AgentMessageFeedbackRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
        request: payload,
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
    it("requires a valid project ID", async () => {
      await createContextForRole("owner")
      projectId = null // reset to a non-null value
      expectResponse(await subject(), 404)
    })
    it("requires a valid agent ID", async () => {
      await createContextForRole("owner")
      agentId = null // reset to a non-null value
      expectResponse(await subject(), 404)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a simple member to get all feedback", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403)
    })
  })
})
