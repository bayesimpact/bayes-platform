import { randomUUID } from "node:crypto"
import { EvalAccountRoutes, TRACE_READ_PERMISSION } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { assignPlatformStaffToUser, ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

describe("Evaluation account - getMe", () => {
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

  const subject = async () => request({ route: EvalAccountRoutes.getMe, token: "token" })

  it("returns the person with only the fields of the contract", async () => {
    const { user } = await createOrganizationWithOwner(repositories, { user: { authSubject } })

    const response = await subject()

    expectSchemaResponse(EvalAccountRoutes.getMe, response, 200)
    expect(response.body.data).toStrictEqual({
      user: { id: user.id, name: user.name, email: user.email, globalPermissions: [] },
    })
  })

  it("returns the global permissions of a platform staff member", async () => {
    const user = await repositories.userRepository.save(userFactory.build({ authSubject }))
    await assignPlatformStaffToUser({ repositories, user })

    const response = await subject()

    expectSchemaResponse(EvalAccountRoutes.getMe, response, 200)
    expect([...response.body.data.user.globalPermissions].sort()).toEqual([
      "backoffice.project.read",
      "backoffice.read",
      TRACE_READ_PERMISSION,
    ])
  })

  it("names a person with no name after their email", async () => {
    const user = await repositories.userRepository.save(
      userFactory.build({ authSubject, email: "helpful.assistant@example.com" }),
    )
    await repositories.userRepository.update({ id: user.id }, { name: null })

    const response = await subject()

    expectSchemaResponse(EvalAccountRoutes.getMe, response, 200)
    expect(response.body.data.user.name).toBe("helpful assistant")
  })
})
