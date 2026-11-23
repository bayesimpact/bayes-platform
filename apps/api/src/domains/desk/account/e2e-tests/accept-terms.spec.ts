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

describe("Desk account - acceptTerms", () => {
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

  /** A person with terms to accept: each terms document has a URL and a version. */
  const createContext = async () => {
    const user = await repositories.userRepository.save(userFactory.build({ authSubject }))
    for (const type of ["general_conditions", "privacy_policy", "ai_usage_policy"] as const) {
      await repositories.termsDocumentRepository.update(
        { type },
        { url: `https://example.com/${type}`, version: 3 },
      )
    }
    return { user }
  }

  const subject = async (payload: unknown) =>
    request({ route: DeskAccountRoutes.acceptTerms, token: "token", body: { payload } })

  it("records the acceptance of the current versions, and the choice for AI usage", async () => {
    const { user } = await createContext()

    const response = await subject({ aiUsagePolicyAccepted: false })

    expectSchemaResponse(DeskAccountRoutes.acceptTerms, response, 201)
    expect(response.body.data).toStrictEqual({ success: true })
    const acceptance = await repositories.termsAcceptanceRepository.findOneByOrFail({
      userId: user.id,
    })
    expect(acceptance).toMatchObject({
      generalConditionsVersion: 3,
      privacyPolicyVersion: 3,
      aiUsagePolicyVersion: 3,
      aiUsagePolicyAccepted: false,
    })
  })

  it("makes getMe say the terms are accepted", async () => {
    await createContext()
    const before = await request({ route: DeskAccountRoutes.getMe, token: "token" })
    expect(before.body.data.user.termsAccepted).toBe(false)

    expectResponse(await subject({ aiUsagePolicyAccepted: true }), 201)

    const after = await request({ route: DeskAccountRoutes.getMe, token: "token" })
    expect(after.body.data.user.termsAccepted).toBe(true)
  })

  it("answers 400 without the choice for AI usage, and records nothing", async () => {
    const { user } = await createContext()

    expectResponse(await subject({}), 400)

    expect(await repositories.termsAcceptanceRepository.countBy({ userId: user.id })).toBe(0)
  })
})
