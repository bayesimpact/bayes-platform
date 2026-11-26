import { AgentModel } from "@bayes-platform/api-contracts"
import { ConfigService } from "@nestjs/config"
import { EncryptionService } from "@/common/encryption/encryption.service"
import type { LLMCallContext } from "@/common/interfaces/llm-provider.interface"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { customModelFactory } from "./custom-model.factory"
import { projectModelFactory } from "./project-model.factory"
import { WorkspaceModelsModule } from "./workspace-models.module"
import { WorkspaceModelsService } from "./workspace-models.service"

describe("WorkspaceModelsService", () => {
  let service: WorkspaceModelsService
  let encryption: EncryptionService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [WorkspaceModelsModule],
      applyOverrides: (moduleBuilder) => moduleBuilder,
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(WorkspaceModelsService)
    encryption = new EncryptionService(setup.module.get(ConfigService))
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  afterEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  /** An agent whose revision runs a model its workspace added. */
  const createAgentOnAddedModel = async (
    customModel: Partial<Parameters<typeof customModelFactory.build>[0]> = {},
  ) => {
    const context = await createOrganizationWithAgent(repositories, {
      agentSettings: { model: AgentModel.Gemma4_26B },
    })
    const added = await repositories.customModelRepository.save(
      customModelFactory.build({ projectId: context.project.id, ...customModel }),
    )
    await repositories.agentSettingsRepository.update(
      { id: context.agentSettings.id },
      { customModelId: added.id },
    )
    const callContext = {
      traceId: "trace-1",
      organizationId: context.organization.id,
      projectId: context.project.id,
      agentId: context.agent.id,
      revision: context.agentSettings.revision,
      agentSessionId: "session-1",
      currentTurn: 1,
    } as LLMCallContext
    return { ...context, added, callContext }
  }

  describe("resolveEndpoint", () => {
    it("sends the call of an agent on an added model to its server, key decrypted", async () => {
      const { callContext } = await createAgentOnAddedModel({
        apiKeyEncrypted: encryption.encrypt("added-key"),
        servedModelName: "gemma-new",
      })

      expect(await service.resolveEndpoint({ callContext, model: AgentModel.Gemma4_26B })).toEqual({
        url: "https://203.0.113.10/v1",
        apiKey: "added-key",
        servedModelName: "gemma-new",
      })
    })

    it("keeps the environment for a call on another model, such as a judge", async () => {
      const { callContext } = await createAgentOnAddedModel()

      expect(
        await service.resolveEndpoint({ callContext, model: AgentModel.Gemini35Flash }),
      ).toBeNull()
    })

    it("keeps the environment for an agent on a model of the code", async () => {
      const context = await createOrganizationWithAgent(repositories, {
        agentSettings: { model: AgentModel.Gemma4_26B },
      })
      const callContext = {
        projectId: context.project.id,
        agentId: context.agent.id,
        revision: context.agentSettings.revision,
      } as LLMCallContext

      expect(
        await service.resolveEndpoint({ callContext, model: AgentModel.Gemma4_26B }),
      ).toBeNull()
    })

    it("never answers a call that claims another workspace", async () => {
      const { callContext } = await createAgentOnAddedModel()
      const otherWorkspace = await createOrganizationWithAgent(repositories)

      expect(
        await service.resolveEndpoint({
          callContext: { ...callContext, projectId: otherWorkspace.project.id },
          model: AgentModel.Gemma4_26B,
        }),
      ).toBeNull()
    })

    it("skips a stored server that is no longer safe", async () => {
      const { callContext } = await createAgentOnAddedModel({ baseUrl: "https://10.0.0.5/v1" })

      expect(
        await service.resolveEndpoint({ callContext, model: AgentModel.Gemma4_26B }),
      ).toBeNull()
    })
  })

  describe("added models", () => {
    it("refuses a type that is not self-hosted", async () => {
      const { project } = await createOrganizationWithAgent(repositories)

      await expect(
        service.createCustomModel({
          projectId: project.id,
          baseModel: AgentModel.Gemini35Flash,
          input: { name: "Hosted", baseUrl: "https://203.0.113.10/v1", servedModelName: null },
        }),
      ).rejects.toThrow("not self-hosted")
    })

    it("keeps the key when the input leaves it out, and removes it on null", async () => {
      const { project } = await createOrganizationWithAgent(repositories)
      const id = await service.createCustomModel({
        projectId: project.id,
        baseModel: AgentModel.Qwen38_27B,
        input: {
          name: "Qwen",
          baseUrl: "https://203.0.113.10/v1",
          apiKey: "secret",
          servedModelName: null,
        },
      })
      const input = {
        name: "Qwen renamed",
        baseUrl: "https://203.0.113.20/v1",
        servedModelName: null,
      }

      await service.updateCustomModel({ projectId: project.id, id, input })
      expect((await service.listCustomModels(project.id))[0]).toMatchObject({
        name: "Qwen renamed",
        hasApiKey: true,
      })

      await service.updateCustomModel({
        projectId: project.id,
        id,
        input: { ...input, apiKey: null },
      })
      expect((await service.listCustomModels(project.id))[0]?.hasApiKey).toBe(false)
    })

    it("refuses to delete a model an agent uses, and counts it", async () => {
      const { project, added } = await createAgentOnAddedModel()

      expect((await service.listCustomModels(project.id))[0]?.agentCount).toBe(1)
      await expect(
        service.deleteCustomModel({ projectId: project.id, id: added.id }),
      ).rejects.toThrow("use this model")
    })
  })

  describe("listEnabledModels", () => {
    it("offers the hosted models and none of the opt-in ones by default", async () => {
      const { project } = await createOrganizationWithAgent(repositories)

      const enabled = await service.listEnabledModels(project.id)

      expect(enabled.has(AgentModel.Gemini35Flash)).toBe(true)
      expect(enabled.has(AgentModel.Gemma4_26B)).toBe(false)
      expect(enabled.has(AgentModel.ClaudeSonnet55)).toBe(false)
      expect(enabled.has(AgentModel.Gpt54)).toBe(false)
    })

    it("follows the rows of the workspace", async () => {
      const { project } = await createOrganizationWithAgent(repositories)
      await repositories.projectModelRepository.save([
        projectModelFactory.build({ projectId: project.id, model: AgentModel.Gemma4_26B }),
        projectModelFactory.build({
          projectId: project.id,
          model: AgentModel.Gemini35Flash,
          enabled: false,
        }),
      ])

      const enabled = await service.listEnabledModels(project.id)

      expect(enabled.has(AgentModel.Gemma4_26B)).toBe(true)
      expect(enabled.has(AgentModel.Gemini35Flash)).toBe(false)
    })
  })
})
