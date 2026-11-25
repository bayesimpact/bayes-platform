import { randomUUID } from "node:crypto"
import { DeskAccountRoutes } from "@bayes-platform/desk-contracts"
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
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk account - getMe", () => {
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

  const subject = async () => request({ route: DeskAccountRoutes.getMe, token: "token" })

  /** Gives each terms document a URL and a version, so the person has terms to accept. */
  const publishTerms = async () => {
    for (const type of ["general_conditions", "privacy_policy", "ai_usage_policy"] as const) {
      await repositories.termsDocumentRepository.update(
        { type },
        { url: `https://example.com/${type}`, version: 2 },
      )
    }
  }

  it("returns the person and the current terms, with only the fields of the contract", async () => {
    const { user } = await createOrganizationWithOwner(repositories, { user: { authSubject } })
    await publishTerms()

    const response = await subject()

    expectSchemaResponse(DeskAccountRoutes.getMe, response, 200)
    expect(response.body.data).toStrictEqual({
      user: { id: user.id, name: user.name, email: user.email, termsAccepted: false },
      currentTerms: {
        generalConditions: { url: "https://example.com/general_conditions", version: 2 },
        privacyPolicy: { url: "https://example.com/privacy_policy", version: 2 },
        aiUsagePolicy: { url: "https://example.com/ai_usage_policy", version: 2 },
      },
    })
  })

  it("says the terms are accepted while a terms document has no URL", async () => {
    await repositories.userRepository.save(userFactory.build({ authSubject }))

    const response = await subject()

    expectSchemaResponse(DeskAccountRoutes.getMe, response, 200)
    expect(response.body.data.user.termsAccepted).toBe(true)
  })

  it("names a person with no name after their email", async () => {
    const user = await repositories.userRepository.save(
      userFactory.build({ authSubject, email: "helpful.assistant@example.com" }),
    )
    await repositories.userRepository.update({ id: user.id }, { name: null })

    const response = await subject()

    expectSchemaResponse(DeskAccountRoutes.getMe, response, 200)
    expect(response.body.data.user.name).toBe("helpful assistant")
  })
})
