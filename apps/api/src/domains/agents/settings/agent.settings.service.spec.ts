import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { afterAll, expect } from "@jest/globals"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AgentsService } from "@/domains/agents/agents.service"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AgentSettingsService, type AgentSettingsValues } from "./agent-settings.service"

function assertOnSettings(expected: object, value: AgentSettingsValues | undefined) {
  expect(value).toBeDefined()
  if (value) {
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.instructions).toBe(expected["instructions"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.model).toBe(expected["model"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(Number(value.temperature)).toBe(Number(expected["temperature"]))
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.locale).toBe(expected["locale"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.documentsRagMode).toBe(expected["documentsRagMode"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.greetingMessage).toBe(expected["greetingMessage"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.outputJsonSchema).toStrictEqual(expected["outputJsonSchema"])
  }
}

async function createAgentWithSettings(
  setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>,
  repositories: AllRepositories,
  agentSettingsValues1: AgentSettingsValues,
  agentSettingsValues2: AgentSettingsValues,
) {
  const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
    agentSettings: agentSettingsValues1,
  })
  const agentSettings2 = agentSettingsFactory
    .transient({ organization: organization, project, agent })
    .build({ ...agentSettingsValues2, revision: 2 })
  await setup.getRepository(AgentSettings).save(agentSettings2)
  return { organization, project, agent }
}

describe("AgentSettings", () => {
  let service: AgentSettingsService
  let agentService: AgentsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
    })
    service = setup.module.get<AgentSettingsService>(AgentSettingsService)
    agentService = setup.module.get<AgentsService>(AgentsService)
    repositories = setup.getAllRepositories()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  const agentSettingsValues1: AgentSettingsValues = {
    instructions: "This is a default prompt 1",
    model: AgentModel.Gemini25Flash,
    temperature: 0,
    locale: AgentLocale.EN,
    documentsRagMode: DocumentsRagMode.All,
    greetingMessage: "This is the greeting message 1",
    // instructionPrompt: "This is the instuction prompt",
    outputJsonSchema: {
      type: "object",
      properties: { aRequiredProperty1: { type: "string" } },
      required: ["aRequiredProperty1"],
    },
  }
  const agentSettingsValues2: AgentSettingsValues = {
    instructions: "This is a default prompt 2",
    model: AgentModel.Gemma4_26B,
    temperature: 1,
    locale: AgentLocale.FR,
    documentsRagMode: DocumentsRagMode.All,
    greetingMessage: "This is the greeting message 2",
    // instructionPrompt: "This is the instuction prompt 2",
    outputJsonSchema: {
      type: "object",
      properties: { aRequiredProperty2: { type: "number" } },
      required: ["aRequiredProperty2"],
    },
  }
  const agentSettingsValues3: AgentSettingsValues = {
    instructions: "This is a default prompt 3",
    model: AgentModel._MockGenerateText,
    temperature: 1,
    locale: AgentLocale.FR,
    documentsRagMode: DocumentsRagMode.All,
    greetingMessage: "This is the greeting message 3",
    // instructionPrompt: "This is the instuction prompt 2",
    outputJsonSchema: {
      type: "object",
      properties: { aRequiredProperty3: { type: "number" } },
      required: ["aRequiredProperty3"],
    },
  }
  describe("AgentSettingsService", () => {
    it("getLast should return settings from Agent - last revision", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        agentSettingsValues1,
        agentSettingsValues2,
      )

      const settings = await service.getLast({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })
      assertOnSettings(agentSettingsValues2, settings)
    })
    it("get should return settings from Agent - specified revision", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        agentSettingsValues1,
        agentSettingsValues2,
      )

      const settings = await service.get({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 1,
      })
      assertOnSettings(agentSettingsValues1, settings)
    })
    it("getAll should return all settings for Agent", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        agentSettingsValues1,
        agentSettingsValues2,
      )

      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })
      expect(settings.length).toBe(2)
      assertOnSettings(agentSettingsValues2, settings[0])
      assertOnSettings(agentSettingsValues1, settings[1])
    })
  })

  describe("AgentService extension", () => {
    it("createAgent should also create settings with revision = 1", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)
      const { agent, agentSettings } = await agentService.createAgent({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fields: {
          ...agentSettingsValues1,
          instructions: agentSettingsValues1.instructions,
          type: "conversation",
          name: "My Template",
        },
        userId: user.id,
      })

      assertOnSettings(agentSettingsValues1, agentSettings)

      const savedSettings = await service.getLast({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      assertOnSettings(agentSettingsValues1, savedSettings)
      expect(savedSettings?.revision).toBe(1)
    })
    it("updateAgent should also create settings with revision = last revision +1", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        agentSettingsValues1,
        agentSettingsValues2,
      )

      let savedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      expect(savedSettings.length).toBe(2)

      const { agentSettings: updatedAgentSettings } = await agentService.updateAgent({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fieldsToUpdate: {
          ...agentSettingsValues3,
          instructions: agentSettingsValues3.instructions,
          name: "My Template 3",
        },
        agentId: agent.id,
      })
      assertOnSettings(agentSettingsValues3, updatedAgentSettings)

      savedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      expect(savedSettings.length).toBe(3)
      assertOnSettings(agentSettingsValues3, savedSettings[0])
      expect(savedSettings[0]?.revision).toBe(3)
    })
    it("deleteAgent should also delete settings", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        agentSettingsValues1,
        agentSettingsValues2,
      )

      let savedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      expect(savedSettings.length).toBe(2)

      await agentService.deleteAgent(agent)

      savedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      expect(savedSettings.length).toBe(0)
    })
  })
})
