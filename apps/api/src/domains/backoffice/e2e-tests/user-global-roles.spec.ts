import { randomUUID } from "node:crypto"
import { type BackofficeGlobalRoleKey, BackofficeRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { PLATFORM_ORG_CREATOR_ROLE, PLATFORM_SUPERADMIN_ROLE } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformOrgCreatorToUser,
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - user global roles", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule, RbacModule, ActivitiesModule],
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

  /** The caller with the given global role, and a person to give a role to. */
  const createContext = async (assignRole: typeof assignPlatformSuperadminToUser) => {
    const { user: caller } = await createOrganizationWithOwner(repositories, {
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    await assignRole({ repositories, user: caller })
    const target = userFactory.build({ email: "target@example.com" })
    await repositories.userRepository.save(target)
    return { caller, target }
  }

  const grant = (userId: string, roleKey: BackofficeGlobalRoleKey) =>
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

  const createOrganizationAs = () =>
    request({
      route: BackofficeRoutes.createOrganization,
      request: { payload: { name: "Sample Organization" } },
      token: "token",
    })

  const globalRoleKeys = async (user: User) => {
    const response = await request({
      route: BackofficeRoutes.getUser,
      pathParams: { userId: user.id },
      token: "token",
    })
    expectResponse(response, 200)
    return response.body.data.globalRoles.map((globalRole) => globalRole.key)
  }

  it("lets a superadmin grant the organization creator role, then revoke it", async () => {
    const { target } = await createContext(assignPlatformSuperadminToUser)

    expectResponse(await grant(target.id, PLATFORM_ORG_CREATOR_ROLE), 201)
    expect(await globalRoleKeys(target)).toEqual([PLATFORM_ORG_CREATOR_ROLE])

    expectResponse(await revoke(target.id, PLATFORM_ORG_CREATOR_ROLE), 200)
    expect(await globalRoleKeys(target)).toEqual([])
  })

  it("is idempotent when the person already holds the role", async () => {
    const { target } = await createContext(assignPlatformSuperadminToUser)
    await assignPlatformOrgCreatorToUser({ repositories, user: target })

    expectResponse(await grant(target.id, PLATFORM_ORG_CREATOR_ROLE), 201)
    expect(await globalRoleKeys(target)).toEqual([PLATFORM_ORG_CREATOR_ROLE])
  })

  it("lets the granted person create an organization", async () => {
    const { target } = await createContext(assignPlatformSuperadminToUser)
    expectResponse(await grant(target.id, PLATFORM_ORG_CREATOR_ROLE), 201)

    const targetSubject = `oidc|${randomUUID()}`
    await repositories.userRepository.update(target.id, {
      authSubject: targetSubject,
      email: mockOidcEmailForSub(targetSubject),
    })
    authSubject = targetSubject
    expectResponse(await createOrganizationAs(), 201)
  })

  it("returns 404 for an unknown user", async () => {
    await createContext(assignPlatformSuperadminToUser)
    expectResponse(await grant(randomUUID(), PLATFORM_ORG_CREATOR_ROLE), 404)
  })

  it("returns 400 for a role that is not a global role", async () => {
    const { target } = await createContext(assignPlatformSuperadminToUser)
    const response = await request({
      route: BackofficeRoutes.grantUserGlobalRole,
      pathParams: { userId: target.id },
      request: { payload: { roleKey: "org_owner" as BackofficeGlobalRoleKey } },
      token: "token",
    })
    expectResponse(response, 400)
    expectResponse(await revoke(target.id, "org_owner"), 400)
  })

  it("refuses to take the role away from the last superadmin", async () => {
    const { caller, target } = await createContext(assignPlatformSuperadminToUser)

    expectResponse(await revoke(caller.id, PLATFORM_SUPERADMIN_ROLE), 400)

    await assignPlatformSuperadminToUser({ repositories, user: target })
    expectResponse(await revoke(caller.id, PLATFORM_SUPERADMIN_ROLE), 200)
  })

  it("records the grant in the activity log", async () => {
    const { target } = await createContext(assignPlatformSuperadminToUser)

    expectResponse(await grant(target.id, PLATFORM_ORG_CREATOR_ROLE), 201)

    const activities = await setup.dataSource.query(`SELECT action FROM activity`)
    expect(activities).toEqual([{ action: "backoffice.user.global_role.grant" }])
  })

  it.each([
    ["platform staff", assignPlatformStaffToUser],
    ["a platform organization creator", assignPlatformOrgCreatorToUser],
  ])("rejects %s, who cannot change global roles", async (_label, assignRole) => {
    const { target } = await createContext(assignRole)
    expectResponse(await grant(target.id, PLATFORM_ORG_CREATOR_ROLE), 403)
    expectResponse(await revoke(target.id, PLATFORM_ORG_CREATOR_ROLE), 403)
  })
})
