import { randomUUID } from "node:crypto"
import { MemberGrantsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { mockForeignAuthSubject, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { MemberGrantsModule } from "../member-grants.module"

describe("Member grants - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [MemberGrantsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async (payload: typeof MemberGrantsRoutes.createMany.request.payload) =>
    request({
      route: MemberGrantsRoutes.createMany,
      token: accessToken ?? undefined,
      request: { payload },
    })

  describe("project target", () => {
    const createContextForRole = async (role: "owner" | "admin" | "member") => {
      const { project } = await createOrganizationWithProject(repositories, {
        user: { authSubject },
        projectMembership: { role },
      })
      return {
        targetType: "project" as const,
        targetId: project.id,
        emails: ["added@example.com"],
      }
    }

    it("requires an authentication token", async () => {
      const payload = await createContextForRole("owner")
      accessToken = null
      expectResponse(await subject(payload), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("returns 400 for an invalid targetType", async () => {
      const payload = await createContextForRole("owner")
      // @ts-expect-error deliberate invalid value for server validation
      expectResponse(await subject({ ...payload, targetType: "not_a_valid_target" }), 400)
    })
    it("requires the user to be a member of the organization", async () => {
      const payload = await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(payload), 403, "You do not have access to this organization")
    })
    it("requires an existing project", async () => {
      const payload = await createContextForRole("owner")
      expectResponse(await subject({ ...payload, targetId: randomUUID() }), 404)
    })
    it("doesn't allow a simple member to add project members", async () => {
      const payload = await createContextForRole("member")
      expectResponse(await subject(payload), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows a project admin to add project members", async () => {
      const payload = await createContextForRole("admin")
      expectResponse(await subject(payload), 201)
    })
    it("allows the project owner to add project members", async () => {
      const payload = await createContextForRole("owner")
      expectResponse(await subject(payload), 201)
    })
  })

  describe("agent target", () => {
    const createContextForAgentRole = async (role: "owner" | "admin" | "member") => {
      const { agent } = await createOrganizationWithAgent(repositories, {
        user: { authSubject },
        projectMembership: { role: "member" },
        agentMembership: { role },
      })
      return { targetType: "agent" as const, targetId: agent.id, emails: ["added@example.com"] }
    }

    it("doesn't allow a simple agent member to add agent members", async () => {
      const payload = await createContextForAgentRole("member")
      expectResponse(await subject(payload), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows an agent admin to add agent members", async () => {
      const payload = await createContextForAgentRole("admin")
      expectResponse(await subject(payload), 201)
    })
    it("requires an existing agent", async () => {
      const payload = await createContextForAgentRole("owner")
      expectResponse(await subject({ ...payload, targetId: randomUUID() }), 404)
    })
  })

  describe("review campaign target", () => {
    const createContextForRole = async (role: "owner" | "admin" | "member") => {
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        { user: { authSubject }, projectMembership: { role } },
      )
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      return {
        targetType: "review_campaign" as const,
        targetId: campaign.id,
        emails: ["tester@example.com"],
        role: "tester",
      }
    }

    it("doesn't allow a simple project member to add campaign members", async () => {
      const payload = await createContextForRole("member")
      expectResponse(await subject(payload), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows a project admin to add campaign members", async () => {
      const payload = await createContextForRole("admin")
      expectResponse(await subject(payload), 201)
    })
  })
})
