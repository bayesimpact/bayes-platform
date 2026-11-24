import { AgentModel } from "@caseai-connect/api-contracts"
import { type AgentModelsOutputDto, EvalAgentsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

describe("Evaluation agents - getModels", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let authSubject = "oidc|123"

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
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async ({ featureFlags = [] }: { featureFlags?: string[] } = {}) => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    for (const featureFlagKey of featureFlags) {
      await repositories.featureFlagRepository.save(
        repositories.featureFlagRepository.create({
          projectId: project.id,
          featureFlagKey,
          enabled: true,
        }),
      )
    }
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!
  }

  const subject = async () =>
    request({
      route: EvalAgentsRoutes.getModels,
      pathParams: { organizationId, projectId },
      token: "token",
    })

  const entryOf = (models: AgentModelsOutputDto["models"], model: AgentModel) =>
    models.find((entry) => entry.model === model)

  it("returns the models and the default judge, with only the fields of the contract", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getModels, response, 200)
    expect(response.body.data.defaults).toStrictEqual({ judge: AgentModel.Gemini35FlashLite })
    expect(response.body.data.models.map((entry) => entry.model)).not.toContain(AgentModel._Mock)
    expect(entryOf(response.body.data.models, AgentModel.Gemini38Flash)).toStrictEqual({
      model: AgentModel.Gemini38Flash,
      isAvailable: true,
      deprecation: null,
      servedOutsideEu: false,
    })
    expect(entryOf(response.body.data.models, AgentModel.Gemini4Carbon)?.servedOutsideEu).toBe(true)
  })

  it("keeps a retired model, unavailable, with its deprecation", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getModels, response, 200)
    const gemini25Flash = entryOf(response.body.data.models, AgentModel.Gemini25Flash)
    expect(gemini25Flash?.isAvailable).toBe(false)
    expect(gemini25Flash?.deprecation).not.toBeNull()
  })

  it("offers a flagged provider's models once the project has its flag", async () => {
    await createContext({ featureFlags: ["gemma"] })

    const response = await subject()

    expectSchemaResponse(EvalAgentsRoutes.getModels, response, 200)
    expect(entryOf(response.body.data.models, AgentModel.Gemma4_26B)?.isAvailable).toBe(true)
    expect(entryOf(response.body.data.models, AgentModel.MistralSmall32_24B)?.isAvailable).toBe(
      false,
    )
  })
})
