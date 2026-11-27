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
import { agentFactory } from "@/domains/agents/agent.factory"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AgentsService } from "@/domains/agents/agents.service"
import { extractionAgentSessionFactory } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.factory"
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
  createOrganizationWithAgentSession,
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
      const settings = await service.getProduction({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })
      assertOnSettings(agentSettingsValuesRev1, settings)
    })
    it("getLast should return settings from Agent - last revision - draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)

      const settings = await service.getLatest({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })
      assertOnSettings(agentSettingsValuesRev3Draft, settings)
    })
    it("getLastSavedOrDraft should prefer the saved revision over a newer draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)

      const settings = await service.getLastSavedOrDraft({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })

      assertOnSettings(agentSettingsValuesRev1, settings)
    })
    it("getLastSavedOrDraft should return the newest saved revision, not an older one in production", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
        agentSettings: { revision: 1 },
      })
      const newestSaved = agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2 })
      await setup.getRepository(AgentSettings).save(newestSaved)
      const connectScope = { organizationId: organization.id, projectId: project.id }

      const settings = await service.getLastSavedOrDraft({ connectScope, agentId: agent.id })

      expect(settings.id).toBe(newestSaved.id)
      expect((await service.getProduction({ connectScope, agentId: agent.id })).revision).toBe(1)
    })
    it("getLastSavedOrDraft should return the draft of an agent that was never saved", async () => {
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        { agentSettings: { isDraft: true } },
      )
      const connectScope = { organizationId: organization.id, projectId: project.id }

      const settings = await service.getLastSavedOrDraft({ connectScope, agentId: agent.id })

      expect(settings.id).toBe(agentSettings.id)
      expect(await service.findProduction({ connectScope, agentId: agent.id })).toBeUndefined()
    })
    it("listAgentIdsInProduction should leave out the agents with only a draft or an archived revision", async () => {
      const {
        organization,
        project,
        agent: publishedAgent,
      } = await createAgentWithSettings(setup, repositories)
      const draftOnlyAgent = await repositories.agentRepository.save(
        agentFactory.transient({ organization, project }).build(),
      )
      const archivedAgent = await repositories.agentRepository.save(
        agentFactory.transient({ organization, project }).build(),
      )
      await setup
        .getRepository(AgentSettings)
        .save([
          agentSettingsFactory
            .transient({ organization, project, agent: draftOnlyAgent })
            .build({ revision: 1, isDraft: true }),
          agentSettingsFactory
            .transient({ organization, project, agent: archivedAgent })
            .build({ revision: 1, isArchived: true }),
          agentSettingsFactory
            .transient({ organization, project, agent: archivedAgent })
            .build({ revision: 2, isDraft: true }),
        ])

      const publishedAgentIds = await service.listAgentIdsInProduction({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentIds: [publishedAgent.id, draftOnlyAgent.id, archivedAgent.id],
      })

      expect([...publishedAgentIds]).toEqual([publishedAgent.id])
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
    it("archive should works - not last - not draft - not in production", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      await service.publish({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        revision: 3,
        setAsProduction: true,
      })
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
    it("archive should NOT works - in production - returns 422", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      await expect(
        service.archive({
          connectScope: { organizationId: organization.id, projectId: project.id },
          agentId: agent.id,
          revision: 1,
        }),
      ).rejects.toThrow("The version in production cannot be archived")
    })
    it("archive should work - draft - discards it, and the next change starts a new draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const connectScope = { organizationId: organization.id, projectId: project.id }
      const { success } = await service.archive({ connectScope, agentId: agent.id, revision: 3 })
      expect(success).toBeTruthy()

      const settings = await service.getAll({
        connectScope,
        agentId: agent.id,
        includesDraft: true,
        includesArchived: true,
      })
      expect(settings.length).toBe(3)
      assertOnSettings(agentSettingsValuesRev3Draft, settings[0])
      expect(settings[0]?.isArchived).toBeTruthy()

      const newDraft = await service.updateSettings({
        connectScope,
        agentId: agent.id,
        agentSettings: { instructions: "A new draft after the discard" },
      })
      expect(newDraft.isDraft).toBe(true)
      expect(newDraft.revision).toBe(4)
      expect(newDraft.instructions).toBe("A new draft after the discard")
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
    it("publish should NOT change the version in production - returns 422", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        true,
      )
      await expect(
        service.publish({
          connectScope: { organizationId: organization.id, projectId: project.id },
          agentId: agent.id,
          revision: 1,
          revisionName: "updated revisionName",
          revisionDesc: "updated revisionDesc",
        }),
      ).rejects.toThrow("The version in production cannot be changed")
      const settings = await service.getAll({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
      })
      expect(settings.length).toBe(1)
      expect(settings[0]?.revisionName).not.toBe("updated revisionName")
    })

    it("publish should keep production on its version unless asked", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const connectScope = { organizationId: organization.id, projectId: project.id }
      const published = await service.publish({ connectScope, agentId: agent.id, revision: 3 })
      expect(published?.isProduction).toBe(false)
      expect((await service.getProduction({ connectScope, agentId: agent.id })).revision).toBe(1)
    })

    it("publish should put the saved version in production when asked", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const connectScope = { organizationId: organization.id, projectId: project.id }
      const published = await service.publish({
        connectScope,
        agentId: agent.id,
        revision: 3,
        setAsProduction: true,
      })
      expect(published?.isProduction).toBe(true)
      expect((await service.getProduction({ connectScope, agentId: agent.id })).revision).toBe(3)
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

    it("saveDraft should save the draft as a version, leaving production on its version", async () => {
      const { organization, project, agent } = await createAgentWithSettings(setup, repositories)
      const connectScope = { organizationId: organization.id, projectId: project.id }

      const saved = await service.saveDraft({
        connectScope,
        agentId: agent.id,
        revisionName: "Shorter answers",
        revisionDesc: "Asks the agent to answer in two sentences",
      })

      expect(saved).toMatchObject({
        revision: 3,
        isDraft: false,
        isProduction: false,
        revisionName: "Shorter answers",
        revisionDesc: "Asks the agent to answer in two sentences",
      })
      const stored = await service.get({ connectScope, agentId: agent.id, revision: 3 })
      expect(stored?.isDraft).toBe(false)
      expect((await service.getProduction({ connectScope, agentId: agent.id })).revision).toBe(1)
    })

    it("saveDraft should leave an agent that was never published without a version in production", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
        agentSettings: { ...agentSettingsValuesRev1, isDraft: true },
      })
      const connectScope = { organizationId: organization.id, projectId: project.id }

      const saved = await service.saveDraft({ connectScope, agentId: agent.id })

      expect(saved).toMatchObject({ revision: 1, isDraft: false, isProduction: false })
      expect(await service.findProduction({ connectScope, agentId: agent.id })).toBeUndefined()
    })

    it("saveDraft should return undefined when the agent has no draft", async () => {
      const { organization, project, agent } = await createAgentWithSettings(
        setup,
        repositories,
        true,
      )
      const connectScope = { organizationId: organization.id, projectId: project.id }

      expect(await service.saveDraft({ connectScope, agentId: agent.id })).toBeUndefined()
      const settings = await service.getAll({
        connectScope,
        agentId: agent.id,
        includesDraft: true,
      })
      expect(settings.map((revision) => [revision.revision, revision.isProduction])).toEqual([
        [1, true],
      ])
    })
  })

  describe("Settings revisions", () => {
    // A new agent runs on an available model, and the service gives it that model's options.
    const newAgentValues = { ...agentSettingsValuesRev1, model: AgentModel.Gemini35Flash }
    const newAgentFields = {
      instructions: newAgentValues.instructions,
      model: newAgentValues.model,
      greetingMessage: newAgentValues.greetingMessage,
      outputJsonSchema: newAgentValues.outputJsonSchema,
    }

    it("createAgent should also create draft settings with revision = 1", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)
      const { agent, agentSettings } = await agentService.createAgent({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fields: {
          ...newAgentFields,
          type: "conversation",
          name: "My Template",
        },
        userId: user.id,
      })

      assertOnSettings(newAgentValues, agentSettings)

      const savedSettings = await service.getLatest({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      assertOnSettings(newAgentValues, savedSettings)
      // A new agent's first revision is a draft, as a copy's is: nothing runs it yet.
      expect(savedSettings?.isDraft).toBe(true)
      expect(savedSettings?.isProduction).toBe(false)
      expect(savedSettings?.revision).toBe(1)
    })

    it("createAgent should set default value for unset fields", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)
      const { agent, agentSettings } = await agentService.createAgent({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fields: {
          ...newAgentFields,
          type: "conversation",
          name: "My Template",
        },
        userId: user.id,
      })

      assertOnSettings(newAgentValues, agentSettings)

      const savedSettings = await service.getLatest({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      assertOnSettings(newAgentValues, savedSettings)
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

      const savedSettings = await service.getLatest({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
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
    describe("a draft that goes back to the published settings", () => {
      const editThenTakeBack = async ({
        connectScope,
        agentId,
        beforeTakingBack,
      }: {
        connectScope: { organizationId: string; projectId: string }
        agentId: string
        beforeTakingBack?: (draft: AgentSettings) => Promise<void>
      }) => {
        const { agentSettings: draft } = await service.updateAllSettings({
          connectScope,
          agentId,
          fieldsToUpdate: { ...agentSettingsValuesRev1, instructions: "An edit to take back" },
        })
        expect(draft.isDraft).toBe(true)
        await beforeTakingBack?.(draft)

        const { agentSettings } = await service.updateAllSettings({
          connectScope,
          agentId,
          fieldsToUpdate: agentSettingsValuesRev1,
        })
        const revisions = await service.getAll({ connectScope, agentId, includesDraft: true })
        return { draft, agentSettings, revisions }
      }

      it("is deleted, and the published revision is the current one again", async () => {
        const { organization, project, agent } = await createAgentWithSettings(
          setup,
          repositories,
          true,
        )
        const connectScope = { organizationId: organization.id, projectId: project.id }

        const { agentSettings, revisions } = await editThenTakeBack({
          connectScope,
          agentId: agent.id,
        })

        expect(agentSettings.isDraft).toBe(false)
        expect(agentSettings.revision).toBe(1)
        expect(revisions.map((revision) => revision.revision)).toEqual([1])
      })

      it("frees its revision number for the next draft", async () => {
        const { organization, project, agent } = await createAgentWithSettings(
          setup,
          repositories,
          true,
        )
        const connectScope = { organizationId: organization.id, projectId: project.id }
        await editThenTakeBack({ connectScope, agentId: agent.id })

        const { agentSettings: nextDraft } = await service.updateAllSettings({
          connectScope,
          agentId: agent.id,
          fieldsToUpdate: { ...agentSettingsValuesRev1, instructions: "Another edit" },
        })

        expect(nextDraft.isDraft).toBe(true)
        expect(nextDraft.revision).toBe(2)
      })

      it("is deleted, and the session that ran on it moves to the published revision", async () => {
        const { organization, project, agent, user, document } =
          await createOrganizationWithAgentSession({
            repositories,
            agentType: "extraction",
            params: { agentSettings: agentSettingsValuesRev1 },
          })
        if (!document) throw new Error("The extraction session fixture has no document")
        const connectScope = { organizationId: organization.id, projectId: project.id }

        let sessionOnDraftId = ""
        const { agentSettings, revisions } = await editThenTakeBack({
          connectScope,
          agentId: agent.id,
          beforeTakingBack: async (draft) => {
            const sessionOnDraft = extractionAgentSessionFactory
              .transient({ organization, project, user, agent, agentSettings: draft, document })
              .build()
            await repositories.extractionAgentSessionRepository.save(sessionOnDraft)
            sessionOnDraftId = sessionOnDraft.id
          },
        })

        expect(agentSettings.isDraft).toBe(false)
        expect(revisions.map((revision) => revision.revision)).toEqual([1])
        const session = await repositories.extractionAgentSessionRepository.findOneBy({
          id: sessionOnDraftId,
        })
        expect(session?.agentSettingsId).toBe(agentSettings.id)
      })

      it("is deleted by a save that changes nothing, when it already equals the published revision", async () => {
        const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
          agentSettings: { ...agentSettingsValuesRev1, outputJsonSchema: null },
        })
        const connectScope = { organizationId: organization.id, projectId: project.id }
        // A draft left behind with the published settings, as older versions of the API did.
        const published = await service.getProduction({ connectScope, agentId: agent.id })
        const leftover = agentSettingsFactory.transient({ organization, project, agent }).build({
          ...agentSettingsValuesRev1,
          outputJsonSchema: null,
          embeddingModel: published.embeddingModel,
          revision: 2,
          isDraft: true,
        })
        await setup.getRepository(AgentSettings).save(leftover)

        const { agentSettings } = await service.updateAllSettings({
          connectScope,
          agentId: agent.id,
          fieldsToUpdate: { instructions: agentSettingsValuesRev1.instructions },
        })

        expect(agentSettings.isDraft).toBe(false)
        const revisions = await service.getAll({
          connectScope,
          agentId: agent.id,
          includesDraft: true,
        })
        expect(revisions.map((revision) => revision.revision)).toEqual([1])
      })

      it("compares with the newest saved revision, not an older one in production", async () => {
        const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
          agentSettings: { ...agentSettingsValuesRev1, outputJsonSchema: null },
        })
        const connectScope = { organizationId: organization.id, projectId: project.id }
        const production = await service.getProduction({ connectScope, agentId: agent.id })
        // Version 2 is saved with other instructions; version 1 stays in production.
        await setup.getRepository(AgentSettings).save(
          agentSettingsFactory.transient({ organization, project, agent }).build({
            ...agentSettingsValuesRev1,
            outputJsonSchema: null,
            embeddingModel: production.embeddingModel,
            instructions: "Version 2 instructions",
            revision: 2,
          }),
        )

        // Restoring version 1 into a draft keeps that draft: it differs from version 2.
        const { agentSettings: restored } = await service.updateAllSettings({
          connectScope,
          agentId: agent.id,
          fieldsToUpdate: { instructions: production.instructions },
        })
        expect(restored.isDraft).toBe(true)
        expect(restored.revision).toBe(3)

        // Bringing the draft back to version 2 deletes it.
        const { agentSettings } = await service.updateAllSettings({
          connectScope,
          agentId: agent.id,
          fieldsToUpdate: { instructions: "Version 2 instructions" },
        })
        expect(agentSettings.isDraft).toBe(false)
        expect(agentSettings.revision).toBe(2)
        expect((await service.getProduction({ connectScope, agentId: agent.id })).revision).toBe(1)
      })

      it("is kept when the agent was never published", async () => {
        const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
          agentSettings: { ...agentSettingsValuesRev1, isDraft: true },
        })
        const connectScope = { organizationId: organization.id, projectId: project.id }

        const { agentSettings, revisions } = await editThenTakeBack({
          connectScope,
          agentId: agent.id,
        })

        expect(agentSettings.isDraft).toBe(true)
        expect(revisions).toHaveLength(1)
      })
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
      // The published revision has a greeting: clearing it in the draft is a change, so the
      // draft stays (a draft that goes back to the published settings is deleted).
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        { agentSettings: { greetingMessage: "Published greeting" } },
      )
      const connectScope = { organizationId: organization.id, projectId: project.id }

      await service.updateAllSettings({
        connectScope,
        agentId: agent.id,
        fieldsToUpdate: { greetingMessage: "New greeting" },
      })
      let updatedAgentSettings = await service.getLatest({
        connectScope,
        agentId: agent.id,
      })
      expect(updatedAgentSettings.greetingMessage).not.toBe(agentSettings.greetingMessage)
      expect(updatedAgentSettings.greetingMessage).toBe("New greeting")
      expect(updatedAgentSettings.isDraft).toBeTruthy()

      await service.updateAllSettings({
        connectScope,
        agentId: agent.id,
        fieldsToUpdate: { greetingMessage: "" },
      })
      updatedAgentSettings = await service.getLatest({
        connectScope,
        agentId: agent.id,
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

      const updatedAgentSettings = await service.getLatest({
        connectScope,
        agentId: agent.id,
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

      const updatedAgentSettings = await service.getLatest({
        connectScope,
        agentId: agent.id,
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
