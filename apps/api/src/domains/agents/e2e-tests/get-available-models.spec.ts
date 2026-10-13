import {
  AgentModel,
  type AgentModelDto,
  AgentProvider,
  AgentsRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"

describe("Agents - getAvailableModels", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
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

  const subject = async () => {
    const response = await request({
      route: AgentsRoutes.getAvailableModels,
      pathParams: removeNullish({ organizationId, projectId }),
      token: "token",
    })
    expectResponse(response, 200)
    return response.body.data as typeof AgentsRoutes.getAvailableModels.response.data
  }
  const entryOf = (models: AgentModelDto[], model: AgentModel) =>
    models.find((entry) => entry.model === model)

  it("lists every model but the test one, in catalog order", async () => {
    await createContext()

    const { models } = await subject()

    expect(models.map((entry) => entry.model)).toEqual([
      AgentModel.Gemini25Flash,
      AgentModel.Gemini25Pro,
      AgentModel.Gemini31FlashLite,
      AgentModel.Gemini35FlashLite,
      AgentModel.Gemini35Flash,
      AgentModel.Gemini36Flash,
      AgentModel.Gemini37Flash,
      AgentModel.Gemini38Flash,
      AgentModel.MedGemma10_27B,
      AgentModel.Gemma4_26B,
      AgentModel.MistralSmall31_24B,
    ])
  })

  it("returns the default models of a new agent and of a new evaluation run", async () => {
    await createContext()

    expect((await subject()).defaults).toEqual({
      agent: AgentModel.Gemini35FlashLite,
      judge: AgentModel.Gemini35FlashLite,
    })
  })

  it("describes each model: provider, retirement, residency", async () => {
    await createContext()

    const { models } = await subject()

    expect(entryOf(models, AgentModel.Gemini25Pro)).toMatchObject({
      provider: AgentProvider.Vertex,
      deprecation: { deprecatedOn: "2026-09-30", recommendedReplacement: AgentModel.Gemini35Flash },
      servedOutsideEu: false,
    })
    expect(entryOf(models, AgentModel.Gemini36Flash)).toMatchObject({
      provider: AgentProvider.Vertex3,
      deprecation: null,
      servedOutsideEu: false,
    })
  })

  it("gives each model its default options and the JSON Schema they follow", async () => {
    await createContext()

    const { models } = await subject()
    const gemini35Flash = entryOf(models, AgentModel.Gemini35Flash)
    const gemini36Flash = entryOf(models, AgentModel.Gemini36Flash)

    expect(gemini35Flash?.defaultOptions).toEqual({
      temperature: 1,
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "medium", includeThoughts: true } },
      },
    })
    expect(gemini35Flash?.optionsSchema).toMatchObject({
      type: "object",
      properties: { temperature: { type: "number" }, providerOptions: { type: "object" } },
    })
    // Google deprecated the temperature of Gemini 3.6: its options have none.
    expect(gemini36Flash?.optionsSchema).toMatchObject({ type: "object" })
    expect(
      (gemini36Flash?.optionsSchema as { properties: Record<string, unknown> }).properties,
    ).not.toHaveProperty("temperature")
  })

  it("offers the vertex 3 models only, without any feature flag", async () => {
    await createContext()

    const { models } = await subject()

    expect(
      new Set(models.filter((entry) => entry.isAvailable).map((entry) => entry.provider)),
    ).toEqual(new Set([AgentProvider.Vertex3]))
    for (const model of [
      AgentModel.MedGemma10_27B,
      AgentModel.Gemma4_26B,
      AgentModel.MistralSmall31_24B,
    ]) {
      expect(entryOf(models, model)?.isAvailable).toBe(false)
    }
  })

  it("offers a flagged provider's models once the project has its flag", async () => {
    await createContext({ featureFlags: ["gemma"] })

    const { models } = await subject()

    expect(entryOf(models, AgentModel.Gemma4_26B)?.isAvailable).toBe(true)
    expect(entryOf(models, AgentModel.MistralSmall31_24B)?.isAvailable).toBe(false)
  })

  it("no longer offers a model past its deprecation date, but still describes it", async () => {
    await createContext()

    const { models } = await subject()

    // Gemini 2.5 was deprecated on 2026-09-30.
    const gemini25Flash = entryOf(models, AgentModel.Gemini25Flash)
    expect(gemini25Flash?.isAvailable).toBe(false)
    expect(gemini25Flash?.deprecation).toMatchObject({ deprecatedOn: "2026-09-30" })
  })
})
