import { randomUUID } from "node:crypto"
import { EvalOrganizationsRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  addUserToOrganization,
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithOwner,
  organizationFactory,
} from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import {
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

describe("Evaluation organizations - getAllMine", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async () => request({ route: EvalOrganizationsRoutes.getAllMine, token: "token" })

  it("returns an empty list when the person has no organization", async () => {
    await repositories.userRepository.save(userFactory.build({ authSubject }))

    const response = await subject()

    expectSchemaResponse(EvalOrganizationsRoutes.getAllMine, response, 200)
    expect(response.body.data).toEqual([])
  })

  it("returns the organizations of an owner with only the fields of the contract", async () => {
    const { organization } = await createOrganizationWithOwner(repositories, {
      user: { authSubject },
    })

    const response = await subject()

    expectSchemaResponse(EvalOrganizationsRoutes.getAllMine, response, 200)
    expect(response.body.data).toStrictEqual([{ id: organization.id, name: organization.name }])
  })

  it("returns the organizations of a member", async () => {
    const { organization } = await createOrganizationWithOwner(repositories)
    const { user: memberUser } = await addUserToOrganization({
      repositories,
      organization,
      membership: { roleKeys: ["org_member"] },
    })
    authSubject = memberUser.authSubject!

    const response = await subject()

    expectSchemaResponse(EvalOrganizationsRoutes.getAllMine, response, 200)
    expect(response.body.data.map((listedOrganization) => listedOrganization.id)).toEqual([
      organization.id,
    ])
  })

  it("returns the organizations sorted by name, case-insensitively", async () => {
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { authSubject },
      organization: { name: "zebra" },
    })
    for (const name of ["Acme", "Northwind"]) {
      const organization = await repositories.organizationRepository.save(
        organizationFactory.build({ name }),
      )
      await saveOrgMembership({
        repositories,
        membership: organizationMembershipFactory
          .withRoles("org_owner")
          .transient({ user, organization })
          .build(),
      })
    }

    const response = await subject()

    expectSchemaResponse(EvalOrganizationsRoutes.getAllMine, response, 200)
    expect(response.body.data.map((organization) => organization.name)).toEqual([
      "Acme",
      "Northwind",
      "zebra",
    ])
  })

  it("leaves out every organization for a platform superadmin with no membership", async () => {
    const user = await repositories.userRepository.save(userFactory.build({ authSubject }))
    await assignPlatformSuperadminToUser({ repositories, user })

    const response = await subject()

    expectSchemaResponse(EvalOrganizationsRoutes.getAllMine, response, 200)
    expect(response.body.data).toEqual([])
  })
})
