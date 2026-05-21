import { randomUUID } from "node:crypto"
import { InvitationsRoutes, ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { mockForeignAuth0Id, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"
import { inviteUserToProject } from "../project-membership.factory"

describe("Project Memberships - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule],
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
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: "owner" | "admin" | "member" = "owner") => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
      projectMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id
    accessToken = "token"
    return { organization, project, user }
  }

  describe("ProjectMembershipRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId }),
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
    it("requires an existing project ID", async () => {
      await createContextForRole("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to list project memberships", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the owner to list project memberships", async () => {
      await createContextForRole("owner")
      expectResponse(await subject(), 200)
    })
    it("allows the admin to list project memberships", async () => {
      await createContextForRole("admin")
      expectResponse(await subject(), 200)
    })
  })

  describe("InvitationsRoutes.createForTarget (project)", () => {
    const invitePayload = (): typeof InvitationsRoutes.createForTarget.request => ({
      payload: {
        targetType: "project",
        targetId: projectId!,
        emails: ["invitee@example.com"],
      },
    })

    const subject = async (payload?: typeof InvitationsRoutes.createForTarget.request) =>
      request({
        route: InvitationsRoutes.createForTarget,
        token: accessToken ?? undefined,
        request: payload ?? invitePayload(),
      })

    it("requires an authentication token", async () => {
      await createContextForRole("owner")
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("returns 400 for an invalid targetType", async () => {
      await createContextForRole("owner")
      const response = await subject({
        payload: {
          // @ts-expect-error deliberate invalid value for server validation
          targetType: "not_a_valid_target",
          targetId: projectId!,
          emails: ["invitee@example.com"],
        },
      })
      expectResponse(response, 400)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 403, "You do not have access to this organization")
    })
    it("requires an existing project as targetId", async () => {
      await createContextForRole("owner")
      const response = await subject({
        payload: {
          targetType: "project",
          targetId: randomUUID(),
          emails: ["invitee@example.com"],
        },
      })
      expectResponse(response, 404)
    })
    it("doesn't allow a simple member to invite project members", async () => {
      await createContextForRole("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("ProjectMembershipRoutes.deleteOne", () => {
    let membershipId: string | null = "random-membership-id"

    const subject = async () =>
      request({
        route: ProjectMembershipRoutes.deleteOne,
        pathParams: removeNullish({ organizationId, projectId, membershipId }),
        token: accessToken ?? undefined,
      })

    const createContextForRoleWithMembership = async (
      role: "owner" | "admin" | "member" = "owner",
    ) => {
      const { organization, project } = await createContextForRole(role)

      // Create an invited user and membership for the project
      const { membership } = await inviteUserToProject({ repositories, organization, project })
      membershipId = membership.id

      return { organization, project, membership }
    }

    beforeEach(() => {
      membershipId = "random-membership-id"
    })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("requires a valid organization ID", async () => {
      await createContextForRoleWithMembership("owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })
    it("requires the user to be a member of the organization", async () => {
      await createContextForRoleWithMembership("owner")
      auth0Id = mockForeignAuth0Id()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
    it("requires an existing project ID", async () => {
      await createContextForRoleWithMembership("owner")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("requires an existing membership ID", async () => {
      await createContextForRoleWithMembership("owner")
      membershipId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("doesn't allow a simple member to remove project memberships", async () => {
      await createContextForRoleWithMembership("member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
