import { MeRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import {
  createOrganizationWithAgent,
  createOrganizationWithOwner,
} from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../test/e2e.helpers"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../test/request"
import { grantConversationReview } from "../agents/conversation-reviewers/agent-conversation-reviewer.factory"
import { MeModule } from "./me.module"

describe("MeController (e2e)", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [MeModule, RbacModule],
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
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, organizationMembership } =
      await createOrganizationWithOwner(repositories)
    authSubject = user.authSubject!
    return { user, organization, organizationMembership }
  }

  const subject = async () =>
    request({
      route: MeRoutes.getMe,
      token: accessToken,
    })

  const patchMeSubject = async (name: string) =>
    request({
      route: MeRoutes.patchMe,
      token: accessToken,
      request: { payload: { name } },
    })

  describe("MeRoutes.patchMe", () => {
    it("requires an authentication token", async () => {
      await createContext()
      accessToken = undefined
      expectResponse(await patchMeSubject("New Name"), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("updates the user name and returns success", async () => {
      const { user } = await createContext()

      const response = await patchMeSubject("Updated Name")

      expectResponse(response, 200)
      expect(response.body.data).toEqual({ success: true })

      const updatedUser = await repositories.userRepository.findOne({ where: { id: user.id } })
      expect(updatedUser?.name).toBe("Updated Name")
    })
  })

  describe("MeRoutes.getMe", () => {
    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("returns user info with empty organizations when user has no orgs", async () => {
      const soloUser = userFactory.build()
      await repositories.userRepository.save(soloUser)
      authSubject = soloUser.authSubject!

      const response = await subject()

      expectResponse(response, 200)
      expect(response.body.data.user).toMatchObject({
        id: soloUser.id,
        email: soloUser.email,
        name: soloUser.name,
        globalPermissions: [],
        conversationReviewAgentIds: [],
      })
      expect(response.body.data.user).not.toHaveProperty("memberships")
      expect(response.body.data.organizations).toEqual([])
    })

    it("returns user info with organization", async () => {
      const { user, organization } = await createContext()

      const response = await subject()

      expectResponse(response, 200)
      expect(response.body.data.user).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
        globalPermissions: [],
      })
      expect(response.body.data.organizations).toHaveLength(1)
      expect(response.body.data.organizations[0]).toMatchObject({
        id: organization.id,
        name: organization.name,
        permissions: expect.arrayContaining(["organization.read"]),
      })
    })

    it("returns the agents the user was granted to review", async () => {
      const { user, agent } = await createOrganizationWithAgent(repositories)
      authSubject = user.authSubject!
      await grantConversationReview({ repositories, user, agent })

      const response = await subject()

      expectResponse(response, 200)
      expect(response.body.data.user.conversationReviewAgentIds).toEqual([agent.id])
    })

    it("returns global permissions of platform_staff users", async () => {
      const user = userFactory.build({ authSubject })
      await repositories.userRepository.save(user)
      await assignPlatformStaffToUser({ repositories, user })

      const response = await subject()

      expectResponse(response, 200)
      expect([...response.body.data.user.globalPermissions].sort()).toEqual([
        "backoffice.project.read",
        "backoffice.read",
        "trace.read",
      ])
    })

    it("returns global permissions of platform_superadmin users", async () => {
      const user = userFactory.build({ authSubject })
      await repositories.userRepository.save(user)
      await assignPlatformSuperadminToUser({ repositories, user })

      const response = await subject()

      expectResponse(response, 200)
      expect([...response.body.data.user.globalPermissions].sort()).toEqual([
        "backoffice.agent.read",
        "backoffice.app.manage",
        "backoffice.conversation_reviewer.update",
        "backoffice.global_role.update",
        "backoffice.maintenance_job.run",
        "backoffice.organization.read",
        "backoffice.project.read",
        "backoffice.project.update",
        "backoffice.read",
        "backoffice.terms.update",
        "backoffice.user.read",
        "organization.create",
        "trace.read",
      ])
    })
  })
})
