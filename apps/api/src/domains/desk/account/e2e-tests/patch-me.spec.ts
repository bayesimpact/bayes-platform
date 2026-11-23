import { randomUUID } from "node:crypto"
import { DeskAccountRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk account - patchMe", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
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

  const createContext = () => repositories.userRepository.save(userFactory.build({ authSubject }))

  const subject = async (payload: unknown) =>
    request({ route: DeskAccountRoutes.patchMe, token: "token", body: { payload } })

  it("updates the name, without the spaces around it", async () => {
    const user = await createContext()

    const response = await subject({ name: "  Helpful Assistant  " })

    expectSchemaResponse(DeskAccountRoutes.patchMe, response, 200)
    expect(response.body.data).toStrictEqual({ success: true })
    const updatedUser = await repositories.userRepository.findOneByOrFail({ id: user.id })
    expect(updatedUser.name).toBe("Helpful Assistant")
  })

  it("answers 400 for an empty name, and keeps the name", async () => {
    const user = await createContext()

    expectResponse(await subject({ name: "   " }), 400)

    const unchangedUser = await repositories.userRepository.findOneByOrFail({ id: user.id })
    expect(unchangedUser.name).toBe(user.name)
  })

  it("answers 400 for a key the contract does not declare", async () => {
    await createContext()

    expectResponse(await subject({ name: "Helpful Assistant", email: "other@example.com" }), 400)
  })
})
