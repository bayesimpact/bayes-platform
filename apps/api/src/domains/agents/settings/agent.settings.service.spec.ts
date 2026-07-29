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
import {
  agentSettingsValuesRev1,
  agentSettingsValuesRev2Archived,
  agentSettingsValuesRev3Draft,
  assertOnSettings,
} from "@/domains/agents/settings/agent.settings.spec.helper"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AgentSettingsService } from "./agent-settings.service"

async function createAgentWithSettings(
  setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>,
  repositories: AllRepositories,
  onlyRev1?: true,
) {
  const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
    agentSettings: {
      ...agentSettingsValuesRev1,
      revisionName: "FirstRev",
      revisionDesc: "The first revision",
    },
  })
  if (!onlyRev1) {
    const agentSettings2 = agentSettingsFactory
      .transient({ organization: organization, project, agent })
      .build({ ...agentSettingsValuesRev2Archived, revision: 2, isArchived: true })

    const agentSettings3 = agentSettingsFactory
      .transient({ organization: organization, project, agent })
      .build({ ...agentSettingsValuesRev3Draft, revision: 3, isDraft: true })

    await setup.getRepository(AgentSettings).save([agentSettings2, agentSettings3])
  }

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

  describe("AgentSettingsService", () => {
    it("getLast should return settings from Agent - last revision - no draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const settings = await service.getLast({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })
      assertOnSettings(agentSettingsValuesRev1, settings)
    })
    it("getLast should return settings from Agent - last revision - draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)

      const settings = await service.getLast({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        includesDraft: true,
      })
      assertOnSettings(agentSettingsValuesRev3Draft, settings)
    })
    it("get should return settings from Agent - specified revision", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)

      const settings = await service.get({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 1,
      })
      assertOnSettings(agentSettingsValuesRev1, settings)
    })
    it("getAll should return all settings for Agent - no draft - no archived", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)

      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })
      expect(settings.length).toBe(1)
      assertOnSettings(agentSettingsValuesRev1, settings[0])
    })

    it("getAll should return all settings for Agent - draft - no archived", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        includesDraft: true,
      })
      expect(settings.length).toBe(2)
      assertOnSettings(agentSettingsValuesRev3Draft, settings[0])
      expect(settings[0]?.isDraft).toBeTruthy()
      assertOnSettings(agentSettingsValuesRev1, settings[1])
    })
    it("getAll should return all settings for Agent - draft - archived", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(settings.length).toBe(3)
      assertOnSettings(agentSettingsValuesRev3Draft, settings[0])
      expect(settings[0]?.isDraft).toBeTruthy()
      assertOnSettings(agentSettingsValuesRev2Archived, settings[1])
      expect(settings[1]?.isArchived).toBeTruthy()
      assertOnSettings(agentSettingsValuesRev1, settings[2])
    })
    it("archive should works - not draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        true,
      )
      // A second published, non-archived revision so revision 1 is not the agent's only
      // readable one: an agent must always keep at least one for `getLast` to find.
      const agentSettings2 = agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ ...agentSettingsValuesRev1, revision: 2 })
      await setup.getRepository(AgentSettings).save(agentSettings2)

      const { success } = await service.archive({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 1,
      })
      expect(success).toBeTruthy()
      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(settings.length).toBe(2)
      const archivedSetting = settings.find((setting) => setting.revision === 1)
      assertOnSettings(agentSettingsValuesRev1, archivedSetting)
      expect(archivedSetting?.isArchived).toBeTruthy()
    })
    it("archive should NOT work - only remaining published revision", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        true,
      )
      const { success } = await service.archive({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 1,
      })
      expect(success).toBeFalsy()
      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })
      expect(settings.length).toBe(1)
      expect(settings[0]?.isArchived).toBeFalsy()
    })
    it("archive should NOT works - draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const { success } = await service.archive({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 3,
      })
      expect(success).toBeFalsy()
      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(settings.length).toBe(3)
      assertOnSettings(agentSettingsValuesRev3Draft, settings[0])
      expect(settings[0]?.isArchived).toBeFalsy()
    })

    it("publish should works - draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const published = await service.publish({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 3,
        revisionName: "publishName",
        revisionDesc: "publishDesc",
      })
      expect(published).toBeDefined()
      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(settings.length).toBe(3)
      assertOnSettings(agentSettingsValuesRev3Draft, settings[0])
      expect(settings[0]?.isDraft).toBeFalsy()
      expect(settings[0]?.revisionName).toBe("publishName")
      expect(settings[0]?.revisionDesc).toBe("publishDesc")
    })
    it("publish should works and update name / desc - not draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        true,
      )
      const published = await service.publish({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 1,
        revisionName: "updated revisionName",
        revisionDesc: "updated revisionDesc",
      })
      expect(published).toBeDefined()
      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })
      expect(settings.length).toBe(1)
      expect(settings[0]?.isDraft).toBeFalsy()
      expect(settings[0]?.revision).toBe(1)
      expect(settings[0]?.revisionName).toBe("updated revisionName")
      expect(settings[0]?.revisionDesc).toBe("updated revisionDesc")
    })

    it("publish should fail - archived", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const published = await service.publish({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 2,
        revisionName: "publishName",
        revisionDesc: "publishDesc",
      })
      expect(published).toBeUndefined()
    })

    it("getByIds should return the revision identity of the requested settings", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const connectScope = { organizationId: organization.id, projectId: project.id }
      const published = await service.get({ connectScope, agentId: agent.id, revision: 1 })
      const draft = await service.get({ connectScope, agentId: agent.id, revision: 3 })
      if (!published || !draft) throw new Error("fixture revisions missing")

      const found = await service.getByIds({ connectScope, ids: [published.id, draft.id] })

      const byId = new Map(found.map((settings) => [settings.id, settings]))
      expect(byId.get(published.id)).toMatchObject({
        revision: 1,
        revisionName: "FirstRev",
        isDraft: false,
      })
      expect(byId.get(draft.id)).toMatchObject({ revision: 3, isDraft: true })
    })

    it("getByIds should not query for an empty id list", async () => {
      const { organization, project } = await createAgentWithSettings(setup, repositories)

      const found = await service.getByIds({
        connectScope: { organizationId: organization.id, projectId: project.id },
        ids: [],
      })

      expect(found).toEqual([])
    })

    it("getByIds should not return settings from another organization", async () => {
      const first = await createAgentWithSettings(setup, repositories)
      const second = await createAgentWithSettings(setup, repositories)
      const secondSettings = await service.get({
        connectScope: { organizationId: second.organization.id, projectId: second.project.id },
        agentId: second.agent.id,
        revision: 1,
      })
      if (!secondSettings) throw new Error("fixture revision missing")

      const found = await service.getByIds({
        connectScope: { organizationId: first.organization.id, projectId: first.project.id },
        ids: [secondSettings.id],
      })

      expect(found).toEqual([])
    })
  })

  describe("AgentService extension", () => {
    it("createAgent should create published settings with revision = 1", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)
      const { agent, agentSettings } = await agentService.createAgent({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fields: {
          ...agentSettingsValuesRev1,
          instructions: agentSettingsValuesRev1.instructions,
          type: "conversation",
          name: "My Template",
        },
        userId: user.id,
      })

      assertOnSettings(agentSettingsValuesRev1, agentSettings)
      expect(agentSettings.isDraft).toBe(false)

      // `getLast` excludes drafts by default: a freshly created agent must be readable through
      // this same default, since every runtime read (playground sessions, streaming, extraction,
      // campaigns, eval runs) goes through it.
      const savedSettings = await service.getLast({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      assertOnSettings(agentSettingsValuesRev1, savedSettings)
      expect(savedSettings?.isDraft).toBe(false)
      expect(savedSettings?.revision).toBe(1)
    })
    it("updateSettings should also create draft settings with revision = last revision +1 - no existing draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        true,
      )

      let savedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(savedSettings.length).toBe(1)

      const updatedFields = {
        ...agentSettingsValuesRev1,
        instructions: "My new instructions",
      }

      const updatedAgentSettings = await service.updateSettings({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentSettings: updatedFields,
        agentId: agent.id,
      })
      assertOnSettings(updatedFields, updatedAgentSettings)

      savedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(savedSettings.length).toBe(2)
      assertOnSettings(updatedFields, savedSettings[0])
      expect(savedSettings[0]?.revision).toBe(2)
      expect(savedSettings[0]?.isDraft).toBeTruthy()
    })

    it("updateSettings should update existing draft settings - existing draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)

      const savedSettings = await service.getLast({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
        includesDraft: true,
      })
      expect(savedSettings.revision).toBe(3)
      expect(savedSettings.isDraft).toBeTruthy()

      const updatedFields = {
        ...agentSettingsValuesRev3Draft,
        instructions: "My updated instructions",
      }

      const updatedAgentSettings = await service.updateSettings({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentSettings: updatedFields,
        agentId: agent.id,
      })
      assertOnSettings(updatedFields, updatedAgentSettings)

      const allSavedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
        includesDraft: true,
      })
      expect(allSavedSettings.length).toBe(2)
      assertOnSettings(updatedFields, allSavedSettings[0])
      expect(allSavedSettings[0]?.revision).toBe(savedSettings.revision)
      expect(allSavedSettings[0]?.isDraft).toBeTruthy()
    })
    it("deleteAgent should also delete settings", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)

      let savedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(savedSettings.length).toBe(3)

      await agentService.deleteAgent(agent)

      savedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(savedSettings.length).toBe(0)
    })
  })
})
