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
import { customModelFactory } from "@/external/llm/workspace-models/custom-model.factory"
import { projectModelFactory } from "@/external/llm/workspace-models/project-model.factory"
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

  const createContext = async ({ enabledModels = [] }: { enabledModels?: AgentModel[] } = {}) => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    for (const model of enabledModels) {
      await repositories.projectModelRepository.save(
        projectModelFactory.build({ projectId: project.id, model }),
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
      AgentModel.Gemini4Argon,
      AgentModel.Gemini4Carbon,
      AgentModel.Gemini4Hydrogen,
      AgentModel.MedGemma10_27B,
      AgentModel.Gemma4_26B,
      AgentModel.Gemma4_31B,
      AgentModel.MistralSmall31_24B,
      AgentModel.MistralSmall32_24B,
      AgentModel.Qwen38_27B,
      AgentModel.ClaudeSonnet55,
      AgentModel.ClaudeHaiku55,
      AgentModel.ClaudeOpus5,
      AgentModel.ClaudeOpus55,
      AgentModel.Gpt54,
      AgentModel.Gpt54Mini,
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
      deprecation: {
        deprecatedOn: "2026-11-19",
        recommendedReplacement: AgentModel.Gemini38Flash,
      },
      servedOutsideEu: false,
    })
    expect(entryOf(models, AgentModel.Gemini38Flash)).toMatchObject({
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

  it("offers the vertex 3 and 4 models only, when no model is set for the workspace", async () => {
    await createContext()

    const { models } = await subject()

    expect(
      new Set(models.filter((entry) => entry.isAvailable).map((entry) => entry.provider)),
    ).toEqual(new Set([AgentProvider.Vertex3, AgentProvider.Vertex4]))
    for (const model of [
      AgentModel.MedGemma10_27B,
      AgentModel.Gemma4_26B,
      AgentModel.Gemma4_31B,
      AgentModel.MistralSmall32_24B,
      AgentModel.Qwen38_27B,
      AgentModel.ClaudeSonnet55,
      AgentModel.ClaudeHaiku55,
      AgentModel.ClaudeOpus5,
      AgentModel.ClaudeOpus55,
      AgentModel.Gpt54,
      AgentModel.Gpt54Mini,
    ]) {
      expect(entryOf(models, model)?.isAvailable).toBe(false)
    }
  })

  it("offers a model once the workspace has it enabled", async () => {
    await createContext({ enabledModels: [AgentModel.Gemma4_26B] })

    const { models } = await subject()

    expect(entryOf(models, AgentModel.Gemma4_26B)?.isAvailable).toBe(true)
    expect(entryOf(models, AgentModel.MistralSmall32_24B)?.isAvailable).toBe(false)
  })

  it("ignores what another workspace turned on", async () => {
    await createContext()
    const otherWorkspace = await createOrganizationWithProject(repositories)
    await repositories.projectModelRepository.save(
      projectModelFactory.build({
        projectId: otherWorkspace.project.id,
        model: AgentModel.Qwen38_27B,
      }),
    )

    const { models } = await subject()

    expect(entryOf(models, AgentModel.Qwen38_27B)?.isAvailable).toBe(false)
  })

  it("hides a default model the workspace has turned off", async () => {
    await createContext()
    await repositories.projectModelRepository.save(
      projectModelFactory.build({
        projectId,
        model: AgentModel.Gemini35Flash,
        enabled: false,
      }),
    )

    const { models } = await subject()

    expect(entryOf(models, AgentModel.Gemini35Flash)?.isAvailable).toBe(false)
  })

  it("lists the models the workspace added, never their server or key", async () => {
    await createContext()
    const added = await repositories.customModelRepository.save(
      customModelFactory.build({
        projectId,
        name: "Gemma on the new server",
        baseModel: AgentModel.Gemma4_26B,
        apiKeyEncrypted: "stored-key",
      }),
    )

    const data = await subject()

    expect(data.customModels).toEqual([
      { id: added.id, name: "Gemma on the new server", baseModel: AgentModel.Gemma4_26B },
    ])
    expect(JSON.stringify(data)).not.toContain("203.0.113.10")
    expect(JSON.stringify(data)).not.toContain("stored-key")
  })

  it("offers the Gemini 4 models by default, carbon outside the EU", async () => {
    await createContext()

    const { models } = await subject()

    for (const model of [AgentModel.Gemini4Argon, AgentModel.Gemini4Hydrogen]) {
      expect(entryOf(models, model)).toMatchObject({
        provider: AgentProvider.Vertex4,
        isAvailable: true,
        servedOutsideEu: false,
      })
    }
    expect(entryOf(models, AgentModel.Gemini4Carbon)).toMatchObject({
      provider: AgentProvider.Vertex4,
      isAvailable: true,
      servedOutsideEu: true,
    })
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
