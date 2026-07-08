import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import { UnprocessableEntityException } from "@nestjs/common"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { createResourceLibraryForProject } from "@/domains/resource-libraries/resource-library.factory"
import { userFactory } from "@/domains/users/user.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { DocumentTag } from "../documents/tags/document-tag.entity"
import { documentTagFactory } from "../documents/tags/document-tag.factory"
import { Agent } from "./agent.entity"
import { AgentsModule } from "./agents.module"
import { AgentsService } from "./agents.service"
import { addUserToAgent } from "./memberships/agent-membership.factory"
import { AgentSettingsService } from "./settings/agent-settings.service"

describe("AgentsService", () => {
  let service: AgentsService
  let agentSettingsService: AgentSettingsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
    })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<AgentsService>(AgentsService)
    agentSettingsService = setup.module.get<AgentSettingsService>(AgentSettingsService)
    repositories = setup.getAllRepositories()
  })

  describe("createAgent", () => {
    it("should create an Agent", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      const { agent, agentSettings } = await service.createAgent({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fields: {
          type: "conversation",
          name: "My Template",
          instructions: "This is a default prompt",
          documentsRagMode: DocumentsRagMode.All,
          model: AgentModel.Gemini25Flash,
          temperature: 0,
          locale: AgentLocale.EN,
        },
        userId: user.id,
      })

      // Assert
      expect(agent.name).toBe("My Template")
      expect(agent.projectId).toBe(project.id)
      expect(agent.id).toBeDefined()

      expect(agentSettings).toBeDefined()
      expect(agentSettings?.instructions).toBe("This is a default prompt")

      const savedTemplate = await repositories.agentRepository.findOne({
        where: { id: agent.id },
      })
      expect(savedTemplate).not.toBeNull()
      expect(savedTemplate?.name).toBe("My Template")
    })

    it("should create admin agent memberships for existing project admins and owners", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      // Add a second user as a project admin
      const adminUser = userFactory.build({ email: "admin@example.com" })
      await repositories.userRepository.save(adminUser)
      await addUserToProject({
        repositories,
        project,
        user: adminUser,
        membership: { role: "admin" },
      })

      // Add a third user as a project member (should NOT get agent membership)
      const memberUser = userFactory.build({ email: "member@example.com" })
      await repositories.userRepository.save(memberUser)
      await addUserToProject({
        repositories,
        project,
        user: memberUser,
        membership: { role: "member" },
      })

      const { agent } = await service.createAgent({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fields: {
          type: "conversation",
          name: "New Agent",
          instructions: "Prompt",
          documentsRagMode: DocumentsRagMode.All,
          model: AgentModel.Gemini25Flash,
          temperature: 0,
          locale: AgentLocale.EN,
        },
        userId: user.id,
      })

      const memberships = await repositories.agentMembershipRepository.find({
        where: { agentId: agent.id },
      })

      // Owner (creator) + admin = 2 memberships
      expect(memberships).toHaveLength(2)

      const ownerMembership = memberships.find((membership) => membership.userId === user.id)
      expect(ownerMembership).toBeDefined()
      expect(ownerMembership?.role).toBe("owner")

      const adminMembership = memberships.find((membership) => membership.userId === adminUser.id)
      expect(adminMembership).toBeDefined()
      expect(adminMembership?.role).toBe("admin")

      // Member should NOT have an agent membership
      const memberMembership = memberships.find((membership) => membership.userId === memberUser.id)
      expect(memberMembership).toBeUndefined()
    })

    it("should throw UnprocessableEntityException when name is less than 3 characters", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      const createWrongfulAgent = async () =>
        service.createAgent({
          connectScope: {
            organizationId: organization.id,
            projectId: project.id,
          },
          fields: {
            type: "conversation",
            name: "AB",
            instructions: "Prompt",
            documentsRagMode: DocumentsRagMode.All,
            model: AgentModel.Gemini25Flash,
            temperature: 0,
            locale: AgentLocale.EN,
          },
          userId: user.id,
        })

      // Act & Assert
      await expect(createWrongfulAgent()).rejects.toThrow(UnprocessableEntityException)
      await expect(createWrongfulAgent()).rejects.toThrow(
        "Agent name must be at least 3 characters long",
      )
    })

    it("should default to conversation type", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      const { agent } = await service.createAgent({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        fields: {
          type: "conversation",
          name: "Conversation Agent",
          instructions: "This is a default prompt",
          documentsRagMode: DocumentsRagMode.All,
          model: AgentModel.Gemini25Flash,
          temperature: 0,
          locale: AgentLocale.EN,
        },
        userId: user.id,
      })

      expect(agent.type).toBe("conversation")
    })

    it("should persist greetingMessage when provided", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      const { agentSettings } = await service.createAgent({
        connectScope: { organizationId: organization.id, projectId: project.id },
        fields: {
          type: "conversation",
          name: "Greeter Agent",
          instructions: "Prompt",
          greetingMessage: "Hi! How can I help you today?",
          documentsRagMode: DocumentsRagMode.All,
          model: AgentModel.Gemini25Flash,
          temperature: 0,
          locale: AgentLocale.EN,
        },
        userId: user.id,
      })
      expect(agentSettings).toBeDefined()
      expect(agentSettings?.greetingMessage).toBe("Hi! How can I help you today?")
    })

    it("should default greetingMessage to null when not provided", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      const { agentSettings } = await service.createAgent({
        connectScope: { organizationId: organization.id, projectId: project.id },
        fields: {
          type: "conversation",
          name: "Silent Agent",
          instructions: "Prompt",
          documentsRagMode: DocumentsRagMode.All,
          model: AgentModel.Gemini25Flash,
          temperature: 0,
          locale: AgentLocale.EN,
        },
        userId: user.id,
      })

      expect(agentSettings).toBeDefined()
      expect(agentSettings?.greetingMessage).toBeNull()
    })

    it("should normalize empty greetingMessage to null", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      const { agentSettings } = await service.createAgent({
        connectScope: { organizationId: organization.id, projectId: project.id },
        fields: {
          type: "conversation",
          name: "Whitespace Agent",
          instructions: "Prompt",
          greetingMessage: "   ",
          documentsRagMode: DocumentsRagMode.All,
          model: AgentModel.Gemini25Flash,
          temperature: 0,
          locale: AgentLocale.EN,
        },
        userId: user.id,
      })
      expect(agentSettings).toBeDefined()
      expect(agentSettings?.greetingMessage).toBeNull()
    })

    it("should require extraction fields when type is extraction", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      const createExtractionWithoutSchema = async () =>
        service.createAgent({
          connectScope: {
            organizationId: organization.id,
            projectId: project.id,
          },
          fields: {
            name: "Extraction Agent",
            instructions: "This is a default prompt",
            documentsRagMode: DocumentsRagMode.All,
            model: AgentModel.Gemini25Flash,
            temperature: 0,
            locale: AgentLocale.EN,
            type: "extraction",
          },
          userId: user.id,
        })

      await expect(createExtractionWithoutSchema()).rejects.toThrow(UnprocessableEntityException)
      await expect(createExtractionWithoutSchema()).rejects.toThrow(
        "Extraction agent requires outputJsonSchema",
      )
    })
  })

  describe("listAgents", () => {
    it("should return Agents for a project", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      const agent1 = agentFactory.transient({ organization, project }).build({
        name: "Template 1",
      })
      const agent2 = agentFactory.transient({ organization, project }).build({
        name: "Template 2",
      })
      await repositories.agentRepository.save([agent1, agent2])
      await addUserToAgent({ repositories, agent: agent1, user })
      await addUserToAgent({ repositories, agent: agent2, user })
      // Act
      const result = await service.listAgents({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        userId: user.id,
      })

      // Assert
      expect(result).toHaveLength(2)
      expect(result.map((t) => t.name)).toContain("Template 1")
      expect(result.map((t) => t.name)).toContain("Template 2")
    })

    it("should return empty array when project has no Agents", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      // Act
      const result = await service.listAgents({
        connectScope: { organizationId: organization.id, projectId: project.id },
        userId: user.id,
      })

      // Assert
      expect(result).toEqual([])
    })

    it("should return Agents ordered by name DESC", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)

      const agent1 = agentFactory.transient({ organization, project }).build({
        name: "Second Template",
      })
      const agent2 = agentFactory.transient({ organization, project }).build({
        name: "First Template",
        createdAt: new Date("2024-01-02"),
      })
      await repositories.agentRepository.save([agent1, agent2])
      await addUserToAgent({ repositories, agent: agent1, user })
      await addUserToAgent({ repositories, agent: agent2, user })
      // Act
      const result = await service.listAgents({
        connectScope: { organizationId: organization.id, projectId: project.id },
        userId: user.id,
      })

      // Assert
      expect(result).toHaveLength(2)
      const [first, second] = result
      expect(first!.name).toBe("First Template")
      expect(second!.name).toBe("Second Template")
    })
  })

  describe("updateAgent", () => {
    it("should update an Agent", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories)

      // Act
      const { agent: updatedAgent, agentSettings: updatedAgentSettings } =
        await service.updateAgent({
          connectScope: { organizationId: organization.id, projectId: project.id },
          agentId: agent.id,
          fieldsToUpdate: {
            name: "Updated Template",
            instructions: "Updated Prompt",
            documentsRagMode: DocumentsRagMode.All,
          },
        })

      expect(updatedAgent.name).toBe("Updated Template")
      expect(updatedAgent.id).toBe(agent.id)

      expect(updatedAgentSettings.instructions).toBe("Updated Prompt")
      expect(updatedAgentSettings.agentId).toBe(agent.id)
      expect(updatedAgentSettings.revision).toBe(2)

      const updatedTemplate = await repositories.agentRepository.findOne({
        where: { id: agent.id },
      })
      expect(updatedTemplate?.name).toBe("Updated Template")

      const updatedPrompt = await repositories.agentSettingsRepository.findOne({
        where: { agentId: agent.id, revision: 2 },
      })
      expect(updatedPrompt).toBeDefined()
      expect(updatedPrompt?.instructions).toBe("Updated Prompt")
    })

    it("should update only name when instructions is not provided", async () => {
      const {
        organization,
        project,
        agent,
        agentSettings: initialAgentSettings,
      } = await createOrganizationWithAgent(repositories)

      const { agent: updatedAgent, agentSettings } = await service.updateAgent({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        fieldsToUpdate: { name: "Updated Name" },
      })

      expect(updatedAgent.name).toBe("Updated Name")

      expect(agentSettings).toBeDefined()
      expect(agentSettings?.instructions).toBe(initialAgentSettings.instructions) // Unchanged
      expect(agentSettings?.revision).toBe(initialAgentSettings.revision) // Unchanged
    })

    it("should throw UnprocessableEntityException when name is less than 3 characters", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories)

      const createWrongfulUpdateAgent = async () =>
        service.updateAgent({
          connectScope: { organizationId: organization.id, projectId: project.id },
          agentId: agent.id,
          fieldsToUpdate: { name: "AB" },
        })

      // Act & Assert
      await expect(createWrongfulUpdateAgent()).rejects.toThrow(UnprocessableEntityException)
      await expect(createWrongfulUpdateAgent()).rejects.toThrow(
        "Agent name must be at least 3 characters long",
      )
    })

    it("should update greetingMessage and clear it with empty string", async () => {
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        {},
      )

      const _afterSet = await service.updateAgent({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        fieldsToUpdate: { greetingMessage: "New greeting" },
      })
      let updatedAgentSettings = await agentSettingsService.getLast({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      expect(updatedAgentSettings.greetingMessage).not.toBe(agentSettings.greetingMessage)
      expect(updatedAgentSettings.greetingMessage).toBe("New greeting")

      const _afterClear = await service.updateAgent({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        fieldsToUpdate: { greetingMessage: "" },
      })

      updatedAgentSettings = await agentSettingsService.getLast({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      expect(updatedAgentSettings.greetingMessage).toBeNull()
    })

    it("should preserve greetingMessage when not provided in a partial update", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
        agentSettings: { greetingMessage: "Keep me" },
      })

      await service.updateAgent({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        fieldsToUpdate: { name: "Renamed" },
      })
      const updatedAgentSettings = await agentSettingsService.getLast({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      expect(updatedAgentSettings?.greetingMessage).toBe("Keep me")
    })

    it("should keep stored tags when switching documentsRagMode to none", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
        agentSettings: { documentsRagMode: DocumentsRagMode.Tags },
      })
      const documentTag = documentTagFactory.transient({ organization, project }).build()
      await setup.getRepository(DocumentTag).save(documentTag)

      await repositories.agentRepository
        .createQueryBuilder()
        .relation(Agent, "documentTags")
        .of(agent.id)
        .add(documentTag.id)

      await service.updateAgent({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        fieldsToUpdate: {
          documentsRagMode: DocumentsRagMode.None,
        },
      })
      const updatedAgentSettings = await agentSettingsService.getLast({
        connectScope: {
          organizationId: organization.id,
          projectId: project.id,
        },
        agentId: agent.id,
      })
      expect(updatedAgentSettings?.documentsRagMode).toBe(DocumentsRagMode.None)

      const updatedAgent = await repositories.agentRepository.findOne({
        where: { id: agent.id },
        relations: ["documentTags"],
      })
      expect(updatedAgent?.documentTags.map((documentTag) => documentTag.id)).toEqual([
        documentTag.id,
      ])
    })
    it("should update resource libraries", async () => {
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

      await service.updateAgent({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        fieldsToUpdate: {
          resourceLibraryIds: [resourceLibrary1.id, resourceLibrary2.id],
        },
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
  })

  describe("deleteAgent", () => {
    it("should delete an Agent", async () => {
      const { agent } = await createOrganizationWithAgent(repositories)

      await service.deleteAgent(agent)

      const deletedAgent = await repositories.agentRepository.findOne({
        where: { id: agent.id },
      })
      expect(deletedAgent).toBeNull()

      const deletedAgentSettings = await repositories.agentSettingsRepository.find({
        where: { id: agent.id },
      })
      expect(deletedAgentSettings).toBeDefined()
      expect(deletedAgentSettings.length).toBe(0)
    })
  })
})
