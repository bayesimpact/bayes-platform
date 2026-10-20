import { randomUUID } from "node:crypto"
import { PROJECT_READ_PERMISSION } from "@caseai-connect/api-contracts"
import { defineSchemaRoute } from "@caseai-connect/desk-contracts"
import { Controller, type INestApplication, Module } from "@nestjs/common"
import type { App } from "supertest/types"
import { z } from "zod"
import { ContextModule } from "@/common/context/context.module"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import { AuthModule } from "@/domains/auth/auth.module"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { UsersModule } from "@/domains/users/users.module"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DeskRoute } from "../desk-route.decorator"

// Two Desk routes that do nothing but pass the guard chain. Their permission, `project.read`, is one
// that campaign testers and reviewers also hold, so a 403 for them comes from the Desk access guard.
const AccessTestRoutes = {
  getProject: defineSchemaRoute({
    method: "get",
    path: "desk/organizations/:organizationId/projects/:projectId/access-test",
    params: z.strictObject({ organizationId: z.uuid(), projectId: z.uuid() }),
    response: z.object({ passed: z.boolean() }),
  }),
  getAgent: defineSchemaRoute({
    method: "get",
    path: "desk/organizations/:organizationId/projects/:projectId/agents/:agentId/access-test",
    params: z.strictObject({ organizationId: z.uuid(), projectId: z.uuid(), agentId: z.uuid() }),
    response: z.object({ passed: z.boolean() }),
  }),
}

const permission = { key: PROJECT_READ_PERMISSION, resource: "project" } as const

@Controller()
class DeskAccessTestController {
  @DeskRoute(AccessTestRoutes.getProject, { permission })
  getProject(): typeof AccessTestRoutes.getProject.response {
    return { data: { passed: true } }
  }

  @DeskRoute(AccessTestRoutes.getAgent, { permission })
  getAgent(): typeof AccessTestRoutes.getAgent.response {
    return { data: { passed: true } }
  }
}

// The imports a module needs to serve Desk routes, as DeskModule has them.
@Module({
  imports: [ContextModule, AuthModule, UsersModule, RbacModule],
  controllers: [DeskAccessTestController],
})
class DeskAccessTestModule {}

type Caller =
  | { kind: "project"; role: "owner" | "admin" | "member"; withAgentMembership: boolean }
  | { kind: "campaign"; role: "tester" | "reviewer" }
  | { kind: "organization"; role: "owner" | "admin" | "member" }

describe("Desk access guard", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`
  let organizationId: string
  let projectId: string
  let agentId: string

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskAccessTestModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** An organization with a project and an agent, and a new caller holding the given roles. */
  const createContextFor = async (caller: Caller) => {
    const { organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id

    const callerAuthSubject = `oidc|${randomUUID()}`
    const callerUser = {
      authSubject: callerAuthSubject,
      email: mockOidcEmailForSub(callerAuthSubject),
    }
    authSubject = callerAuthSubject

    if (caller.kind === "campaign") {
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        role: caller.role,
        user: callerUser,
      })
      return
    }

    const { user } = await addUserToOrganization({
      repositories,
      organization,
      user: callerUser,
      membership: { role: caller.kind === "organization" ? caller.role : "member" },
    })
    if (caller.kind === "organization") return

    await addUserToProject({ repositories, project, user, membership: { role: caller.role } })
    if (caller.withAgentMembership) {
      await addUserToAgent({ repositories, agent, user, membership: { role: "member" } })
    }
  }

  const getProject = () =>
    request({
      route: AccessTestRoutes.getProject,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  const getAgent = () =>
    request({
      route: AccessTestRoutes.getAgent,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })

  it.each([
    { role: "owner", withAgentMembership: true },
    { role: "owner", withAgentMembership: false },
    { role: "admin", withAgentMembership: true },
    { role: "admin", withAgentMembership: false },
    { role: "member", withAgentMembership: true },
  ] as const)("lets a project $role in, on the project and on an agent (agent membership: $withAgentMembership)", async ({
    role,
    withAgentMembership,
  }) => {
    await createContextFor({ kind: "project", role, withAgentMembership })
    expectResponse(await getProject(), 200)
    expectResponse(await getAgent(), 200)
  })

  it("answers 404 on an agent a project member holds no membership on", async () => {
    await createContextFor({ kind: "project", role: "member", withAgentMembership: false })
    expectResponse(await getProject(), 200)
    expectResponse(await getAgent(), 404)
  })

  it.each([
    "tester",
    "reviewer",
  ] as const)("keeps a review campaign %s out, though they hold the route's permission", async (role) => {
    await createContextFor({ kind: "campaign", role })
    expectResponse(await getProject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await getAgent(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it.each([
    "owner",
    "admin",
    "member",
  ] as const)("keeps an organization %s with no project role out", async (role) => {
    await createContextFor({ kind: "organization", role })
    expectResponse(await getProject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await getAgent(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("answers 401 to a person outside the organization", async () => {
    await createContextFor({ kind: "project", role: "owner", withAgentMembership: true })
    authSubject = mockForeignAuthSubject()
    expectResponse(await getProject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
  })
})
