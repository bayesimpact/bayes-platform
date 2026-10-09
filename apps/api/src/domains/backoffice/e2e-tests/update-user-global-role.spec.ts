import { randomUUID } from "node:crypto"
import { BackofficeRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  AGENT_CONVERSATION_REVIEW_PERMISSION,
  CONVERSATION_REVIEWER_ROLE,
  PLATFORM_SUPERADMIN_ROLE,
} from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignConversationReviewerToUser,
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - grant and revoke a user's global role", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let permissionService: PermissionService

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule, RbacModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    permissionService = setup.module.get(PermissionService)
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

  const createCaller = async (assignRole: typeof assignPlatformSuperadminToUser) => {
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    await assignRole({ repositories, user })
    return user
  }

  const createTargetUser = async () => {
    const target = userFactory.build()
    await repositories.userRepository.save(target)
    return target
  }

  const grant = (userId: string, roleKey: string) =>
    request({
      route: BackofficeRoutes.grantUserGlobalRole,
      pathParams: { userId },
      request: { payload: { roleKey } },
      token: "token",
    })

  const revoke = (userId: string, roleKey: string) =>
    request({
      route: BackofficeRoutes.revokeUserGlobalRole,
      pathParams: { userId, roleKey },
      token: "token",
    })

  it("nobody holds the conversation review permission by default, superadmins included", async () => {
    const caller = await createCaller(assignPlatformSuperadminToUser)
    await expect(
      permissionService.hasGlobal(caller.id, AGENT_CONVERSATION_REVIEW_PERMISSION),
    ).resolves.toBe(false)
  })

  it("lets a superadmin grant the conversation reviewer role, then revoke it", async () => {
    await createCaller(assignPlatformSuperadminToUser)
    const target = await createTargetUser()

    expectResponse(await grant(target.id, CONVERSATION_REVIEWER_ROLE), 201)
    await expect(
      permissionService.hasGlobal(target.id, AGENT_CONVERSATION_REVIEW_PERMISSION),
    ).resolves.toBe(true)

    const detail = await request({
      route: BackofficeRoutes.getUser,
      pathParams: { userId: target.id },
      token: "token",
    })
    expectResponse(detail, 200)
    expect(detail.body.data.globalRoles).toEqual([
      expect.objectContaining({
        key: CONVERSATION_REVIEWER_ROLE,
        permissions: [AGENT_CONVERSATION_REVIEW_PERMISSION],
      }),
    ])
    expect(detail.body.data.grantableGlobalRoles).toEqual([
      {
        key: CONVERSATION_REVIEWER_ROLE,
        name: "Conversation Reviewer",
        permissions: [AGENT_CONVERSATION_REVIEW_PERMISSION],
      },
    ])

    expectResponse(await revoke(target.id, CONVERSATION_REVIEWER_ROLE), 200)
    await expect(
      permissionService.hasGlobal(target.id, AGENT_CONVERSATION_REVIEW_PERMISSION),
    ).resolves.toBe(false)
  })

  it("is idempotent when the user already holds the role", async () => {
    await createCaller(assignPlatformSuperadminToUser)
    const target = await createTargetUser()
    await assignConversationReviewerToUser({ repositories, user: target })

    expectResponse(await grant(target.id, CONVERSATION_REVIEWER_ROLE), 201)
    await expect(
      permissionService.hasGlobal(target.id, AGENT_CONVERSATION_REVIEW_PERMISSION),
    ).resolves.toBe(true)
  })

  it("refuses a role the backoffice does not hand out", async () => {
    await createCaller(assignPlatformSuperadminToUser)
    const target = await createTargetUser()

    expectResponse(await grant(target.id, PLATFORM_SUPERADMIN_ROLE), 400)
    expectResponse(await revoke(target.id, PLATFORM_SUPERADMIN_ROLE), 400)
  })

  it("returns 404 for an unknown user", async () => {
    await createCaller(assignPlatformSuperadminToUser)

    expectResponse(await grant(randomUUID(), CONVERSATION_REVIEWER_ROLE), 404)
  })

  it("rejects platform staff, who cannot update global roles", async () => {
    await createCaller(assignPlatformStaffToUser)
    const target = await createTargetUser()

    expectResponse(await grant(target.id, CONVERSATION_REVIEWER_ROLE), 403)
    expectResponse(await revoke(target.id, CONVERSATION_REVIEWER_ROLE), 403)
  })
})
