import { AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { afterAll, expect } from "@jest/globals"
import { NotFoundException } from "@nestjs/common"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { Agent } from "@/domains/agents/agent.entity"
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
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { documentTagFactory } from "@/domains/documents/tags/document-tag.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { createResourceLibraryForProject } from "@/domains/resource-libraries/resource-library.factory"
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
    it("archive should works - not last - not draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
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
      expect(settings.length).toBe(3)
      assertOnSettings(agentSettingsValuesRev1, settings[2])
      expect(settings[2]?.isArchived).toBeTruthy()
    })
    it("archive NOT should works - last - returns 422", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      await service.publish({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 3,
      })
      await expect(
        service.archive({
          connectScope: { organizationId: organization.id, projectId: project.id },
          agentId: agent.id,
          revision: 3,
        }),
      ).rejects.toThrow("Cannot archive the last revision")

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
  })

  describe("Settings revisions", () => {
    it("createAgent should also create published settings with revision = 1", async () => {
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

      const savedSettings = await service.getLast({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
        includesDraft: true,
      })
      assertOnSettings(agentSettingsValuesRev1, savedSettings)
      // Creating an agent publishes its first revision right away.
      expect(savedSettings?.isDraft).toBeFalsy()
      expect(savedSettings?.revision).toBe(1)
    })
    it("updateAllSettings should create draft settings with revision = last revision +1 - no existing draft", async () => {
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

      const { agentSettings: updatedAgentSettings } = await service.updateAllSettings({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fieldsToUpdate: updatedFields,
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
    it("updateAllSettings should create draft settings with revision = last revision +1 - no existing draft - last revision archived", async () => {
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
      // @ts-expect-error
      const archivedSettings: AgentSettings = savedSettings[0]
      archivedSettings.isArchived = true
      archivedSettings.isDraft = false
      await repositories.agentSettingsRepository.save(archivedSettings)

      const updatedFields = {
        ...agentSettingsValuesRev3Draft,
        instructions: "My new instructions",
      }

      const { agentSettings: updatedAgentSettings } = await service.updateAllSettings({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fieldsToUpdate: updatedFields,
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
      expect(savedSettings.length).toBe(4)
      assertOnSettings(updatedFields, savedSettings[0])
      expect(savedSettings[0]?.revision).toBe(4)
      expect(savedSettings[0]?.isDraft).toBeTruthy()
    })
    it("updateAllSettings should update existing draft settings - existing draft", async () => {
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

      const { agentSettings: updatedAgentSettings } = await service.updateAllSettings({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fieldsToUpdate: updatedFields,
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
    it("updateAllSettings should create a draft revision with the updated fields", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories)

      const { agent: updatedAgent, agentSettings: updatedAgentSettings } =
        await service.updateAllSettings({
          connectScope: { organizationId: organization.id, projectId: project.id },
          agentId: agent.id,
          fieldsToUpdate: {
            instructions: "Updated Prompt",
            documentsRagMode: DocumentsRagMode.All,
          },
        })

      expect(updatedAgent.id).toBe(agent.id)
      expect(updatedAgentSettings.agentId).toBe(agent.id)
      expect(updatedAgentSettings.instructions).toBe("Updated Prompt")
      expect(updatedAgentSettings.revision).toBe(2)

      const savedSettings = await repositories.agentSettingsRepository.findOne({
        where: { agentId: agent.id, revision: 2 },
      })
      expect(savedSettings?.instructions).toBe("Updated Prompt")
      expect(savedSettings?.isDraft).toBeTruthy()
    })

    it("updateAllSettings should update greetingMessage and clear it with an empty string", async () => {
      const { organization, project, agent, agentSettings } =
        await createOrganizationWithAgent(repositories)
      const connectScope = { organizationId: organization.id, projectId: project.id }

      await service.updateAllSettings({
        connectScope,
        agentId: agent.id,
        fieldsToUpdate: { greetingMessage: "New greeting" },
      })
      let updatedAgentSettings = await service.getLast({
        connectScope,
        agentId: agent.id,
        includesDraft: true,
      })
      expect(updatedAgentSettings.greetingMessage).not.toBe(agentSettings.greetingMessage)
      expect(updatedAgentSettings.greetingMessage).toBe("New greeting")
      expect(updatedAgentSettings.isDraft).toBeTruthy()

      await service.updateAllSettings({
        connectScope,
        agentId: agent.id,
        fieldsToUpdate: { greetingMessage: "" },
      })
      updatedAgentSettings = await service.getLast({
        connectScope,
        agentId: agent.id,
        includesDraft: true,
      })
      expect(updatedAgentSettings.greetingMessage).toBeNull()
      expect(updatedAgentSettings.isDraft).toBeTruthy()
    })

    it("updateAllSettings should preserve greetingMessage when a partial update omits it", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
        agentSettings: { greetingMessage: "Keep me" },
      })
      const connectScope = { organizationId: organization.id, projectId: project.id }

      await service.updateAllSettings({
        connectScope,
        agentId: agent.id,
        fieldsToUpdate: { instructions: "New instructions" },
      })

      const updatedAgentSettings = await service.getLast({
        connectScope,
        agentId: agent.id,
        includesDraft: true,
      })
      expect(updatedAgentSettings.instructions).toBe("New instructions")
      expect(updatedAgentSettings.greetingMessage).toBe("Keep me")
    })

    it("updateAllSettings should keep stored tags when switching documentsRagMode to none", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
        agentSettings: { documentsRagMode: DocumentsRagMode.Tags },
      })
      const connectScope = { organizationId: organization.id, projectId: project.id }
      const documentTag = documentTagFactory.transient({ organization, project }).build()
      await setup.getRepository(DocumentTag).save(documentTag)

      await repositories.agentRepository
        .createQueryBuilder()
        .relation(Agent, "documentTags")
        .of(agent.id)
        .add(documentTag.id)

      await service.updateAllSettings({
        connectScope,
        agentId: agent.id,
        fieldsToUpdate: { documentsRagMode: DocumentsRagMode.None },
      })

      const updatedAgentSettings = await service.getLast({
        connectScope,
        agentId: agent.id,
        includesDraft: true,
      })
      expect(updatedAgentSettings.documentsRagMode).toBe(DocumentsRagMode.None)

      const updatedAgent = await repositories.agentRepository.findOne({
        where: { id: agent.id },
        relations: ["documentTags"],
      })
      expect(updatedAgent?.documentTags.map((documentTag) => documentTag.id)).toEqual([
        documentTag.id,
      ])
    })

    it("updateAllSettings should update resource libraries", async () => {
      const { organization, project, agent, agentResourceLibraries } =
        await createOrganizationWithAgent(repositories, {
          agentSettings: { documentsRagMode: DocumentsRagMode.Tags },
        })
      const initialAgent = await repositories.agentRepository.findOne({
        where: { id: agent.id },
        relations: ["resourceLibraries"],
      })
      expect(initialAgent?.resourceLibraries.map((resourceLib) => resourceLib.id)).toEqual([
        agentResourceLibraries[0]?.id,
      ])

      const resourceLibrary1 = await createResourceLibraryForProject({
        repositories,
        organization,
        project,
      })
      const resourceLibrary2 = await createResourceLibraryForProject({
        repositories,
        organization,
        project,
      })

      await service.updateAllSettings({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        fieldsToUpdate: { resourceLibraryIds: [resourceLibrary1.id, resourceLibrary2.id] },
      })

      const updatedAgent = await repositories.agentRepository.findOne({
        where: { id: agent.id },
        relations: ["resourceLibraries"],
      })
      expect(updatedAgent?.resourceLibraries.map((resourceLib) => resourceLib.id)).toEqual([
        resourceLibrary1.id,
        resourceLibrary2.id,
      ])
    })
    describe("priority calls", () => {
      it("updateAllSettings should persist priorityCallsEnabled on any model", async () => {
        const { organization, project, agent } = await createOrganizationWithAgent(repositories)

        const { agentSettings: updatedAgentSettings } = await service.updateAllSettings({
          connectScope: { organizationId: organization.id, projectId: project.id },
          agentId: agent.id,
          fieldsToUpdate: { model: AgentModel.Gemini35Flash, priorityCallsEnabled: true },
        })

        expect(updatedAgentSettings.priorityCallsEnabled).toBe(true)
        const savedSettings = await repositories.agentSettingsRepository.findOne({
          where: { agentId: agent.id, revision: updatedAgentSettings.revision },
        })
        expect(savedSettings?.priorityCallsEnabled).toBe(true)
      })
    })

    it("updateAllSettings should THROW on unexpected use case => only one revision that is archived (impossible use case : archive is not possible on the last revision)", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        true,
      )

      const savedSettings = await service.getAll({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(savedSettings.length).toBe(1)
      // @ts-expect-error
      const archivedSettings: AgentSettings = savedSettings[0]
      archivedSettings.isArchived = true
      await repositories.agentSettingsRepository.save(archivedSettings)

      const updatedFields = {
        ...agentSettingsValuesRev1,
        instructions: "My new instructions",
      }

      await expect(
        service.updateAllSettings({
          connectScope: {
            organizationId: organization.id,
            projectId: project.id,
          },
          fieldsToUpdate: updatedFields,
          agentId: agent.id,
        }),
      ).rejects.toThrow(NotFoundException)
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
