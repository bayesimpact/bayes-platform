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
import {
  AGENT_ROLE_PERMISSIONS,
  AGENT_ROLES,
  CATALOG_ROLE_KEYS,
  ORGANIZATION_ROLE_PERMISSIONS,
  ORGANIZATION_ROLES,
  PERMISSION_DESCRIPTIONS,
  PLATFORM_STAFF_ROLE,
  PLATFORM_SUPERADMIN_ROLE,
  PROJECT_ROLE_PERMISSIONS,
  PROJECT_ROLES,
} from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - get RBAC catalog", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule, RbacModule],
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

  const createAuthorizedUser = async () => {
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    await assignPlatformSuperadminToUser({ repositories, user })
    return user
  }

  it("returns the official catalog roles and permission descriptions", async () => {
    await createAuthorizedUser()
    const response = await request({
      route: BackofficeRoutes.getRbacCatalog,
      token: "token",
    })
    expectResponse(response, 200)

    const { roles, permissions } = response.body.data
    expect(roles.map((role: { key: string }) => role.key)).toEqual([...CATALOG_ROLE_KEYS])

    const rolesByKey = new Map(
      roles.map((role: { key: string; permissions: string[]; scopeType: string }) => [
        role.key,
        role,
      ]),
    )
    expect(rolesByKey.get(ORGANIZATION_ROLES.owner)?.scopeType).toBe("organization")
    expect(new Set(rolesByKey.get(ORGANIZATION_ROLES.owner)?.permissions)).toEqual(
      new Set(ORGANIZATION_ROLE_PERMISSIONS.org_owner),
    )
    expect(rolesByKey.get(PROJECT_ROLES.owner)?.scopeType).toBe("project")
    expect(new Set(rolesByKey.get(PROJECT_ROLES.owner)?.permissions)).toEqual(
      new Set(PROJECT_ROLE_PERMISSIONS.project_owner),
    )
    expect(rolesByKey.get(AGENT_ROLES.owner)?.scopeType).toBe("agent")
    expect(new Set(rolesByKey.get(AGENT_ROLES.owner)?.permissions)).toEqual(
      new Set(AGENT_ROLE_PERMISSIONS.agent_owner),
    )
    expect(rolesByKey.get(PLATFORM_STAFF_ROLE)?.scopeType).toBe("global")
    expect(rolesByKey.get(PLATFORM_SUPERADMIN_ROLE)?.scopeType).toBe("global")

    const permissionKeys = permissions.map((permission: { key: string }) => permission.key)
    expect(permissionKeys).toEqual(expect.arrayContaining(Object.keys(PERMISSION_DESCRIPTIONS)))
    const backofficeRead = permissions.find(
      (permission: { key: string }) => permission.key === "backoffice.read",
    )
    expect(backofficeRead?.description).toBe(PERMISSION_DESCRIPTIONS["backoffice.read"])
  })
})
