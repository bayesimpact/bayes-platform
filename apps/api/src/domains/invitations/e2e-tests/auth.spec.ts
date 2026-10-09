import { randomUUID } from "node:crypto"
import { MyInvitationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { invitationFactory } from "../invitation.factory"
import { InvitationsModule } from "../invitations.module"
import { type InvitationRouteTarget, invitationRoutesFor } from "./invitation-routes.helpers"

type Role = "owner" | "admin" | "member"

describe("Invitations - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule],
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
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** Calls the three admin routes of a target and returns their statuses. */
  const callAdminRoutes = async (target: InvitationRouteTarget, invitationId: string) => {
    const { routes, pathParams } = invitationRoutesFor(target)
    const token = accessToken ?? undefined
    const getAll = await request({ route: routes.getAll, pathParams, token })
    const createMany = await request({
      route: routes.createMany,
      pathParams,
      token,
      request: { payload: { emails: ["invited@example.com"], role: "tester" } },
    })
    const deleteOne = await request({
      route: routes.deleteOne,
      pathParams: { ...pathParams, invitationId },
      token,
    })
    return { getAll, createMany, deleteOne }
  }

  const expectAllowed = (responses: Awaited<ReturnType<typeof callAdminRoutes>>) => {
    expectResponse(responses.getAll, 200)
    expectResponse(responses.createMany, 201)
    expectResponse(responses.deleteOne, 200)
  }

  const expectAll = (
    responses: Awaited<ReturnType<typeof callAdminRoutes>>,
    status: number,
    message?: string,
  ) => {
    expectResponse(responses.getAll, status, message)
    expectResponse(responses.createMany, status, message)
    expectResponse(responses.deleteOne, status, message)
  }

  const savePendingInvitation = async (
    target: Parameters<typeof invitationFactory.transient>[0],
  ) => {
    const invitedUser = await repositories.userRepository.save(
      userFactory.build({ authSubject: null }),
    )
    return repositories.invitationRepository.save(
      invitationFactory.transient({ ...target, user: invitedUser }).build(),
    )
  }

  describe("project invitations", () => {
    const createContextForRole = async (role: Role) => {
      const { project } = await createOrganizationWithProject(repositories, {
        user: { authSubject },
        projectMembership: { role },
      })
      const invitation = await savePendingInvitation({ project })
      return { target: { project }, invitationId: invitation.id }
    }

    it("requires an authentication token", async () => {
      const { target, invitationId } = await createContextForRole("owner")
      accessToken = null
      expectAll(await callAdminRoutes(target, invitationId), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires the user to be a member of the organization", async () => {
      const { target, invitationId } = await createContextForRole("owner")
      authSubject = mockForeignAuthSubject()
      expectAll(await callAdminRoutes(target, invitationId), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("doesn't allow a project member", async () => {
      const { target, invitationId } = await createContextForRole("member")
      expectAll(await callAdminRoutes(target, invitationId), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows a project admin", async () => {
      const { target, invitationId } = await createContextForRole("admin")
      expectAllowed(await callAdminRoutes(target, invitationId))
    })
    it("allows the project owner", async () => {
      const { target, invitationId } = await createContextForRole("owner")
      expectAllowed(await callAdminRoutes(target, invitationId))
    })
  })

  describe("agent invitations", () => {
    const createContextForRoles = async (roles: { project: Role; agent: Role }) => {
      const { agent } = await createOrganizationWithAgent(repositories, {
        user: { authSubject },
        projectMembership: { role: roles.project },
        agentMembership: { role: roles.agent },
      })
      const invitation = await savePendingInvitation({ agent })
      return { target: { agent }, invitationId: invitation.id }
    }

    it("doesn't allow an agent member", async () => {
      const { target, invitationId } = await createContextForRoles({
        project: "member",
        agent: "member",
      })
      expectAll(await callAdminRoutes(target, invitationId), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("doesn't pass the right down from the project", async () => {
      const { target, invitationId } = await createContextForRoles({
        project: "owner",
        agent: "member",
      })
      expectAll(await callAdminRoutes(target, invitationId), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows an agent admin", async () => {
      const { target, invitationId } = await createContextForRoles({
        project: "member",
        agent: "admin",
      })
      expectAllowed(await callAdminRoutes(target, invitationId))
    })
    it("allows the agent owner", async () => {
      const { target, invitationId } = await createContextForRoles({
        project: "member",
        agent: "owner",
      })
      expectAllowed(await callAdminRoutes(target, invitationId))
    })
  })

  describe("review campaign invitations", () => {
    const createContextForRole = async (role: Role) => {
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        { user: { authSubject }, projectMembership: { role } },
      )
      const reviewCampaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      const invitation = await savePendingInvitation({ reviewCampaign })
      return { organization, target: { reviewCampaign }, invitationId: invitation.id }
    }

    /** Switches the caller to an organization admin who holds no role on the project. */
    const switchToOrganizationAdminWithoutProjectRole = async ({
      organization,
    }: Awaited<ReturnType<typeof createContextForRole>>) => {
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

    it("doesn't allow a project member", async () => {
      const { target, invitationId } = await createContextForRole("member")
      expectAll(await callAdminRoutes(target, invitationId), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("doesn't allow an organization admin who holds no project role", async () => {
      const context = await createContextForRole("owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectAll(
        await callAdminRoutes(context.target, context.invitationId),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })
    it("allows a project admin", async () => {
      const { target, invitationId } = await createContextForRole("admin")
      expectAllowed(await callAdminRoutes(target, invitationId))
    })
    it("allows the project owner", async () => {
      const { target, invitationId } = await createContextForRole("owner")
      expectAllowed(await callAdminRoutes(target, invitationId))
    })
  })

  describe("routes of the invited person", () => {
    it("require an authentication token", async () => {
      accessToken = null
      const invitationId = randomUUID()
      expectResponse(
        await request({ route: MyInvitationsRoutes.getAll }),
        401,
        AUTH_ERRORS.NO_ACCESS_TOKEN,
      )
      expectResponse(
        await request({ route: MyInvitationsRoutes.acceptOne, pathParams: { invitationId } }),
        401,
        AUTH_ERRORS.NO_ACCESS_TOKEN,
      )
      expectResponse(
        await request({ route: MyInvitationsRoutes.declineOne, pathParams: { invitationId } }),
        401,
        AUTH_ERRORS.NO_ACCESS_TOKEN,
      )
    })
  })
})
