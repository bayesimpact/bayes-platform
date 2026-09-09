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
import { userFactory } from "@/domains/users/user.factory"
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
    service = setup.module.get<AgentsService>(AgentsService)
    agentSettingsService = setup.module.get<AgentSettingsService>(AgentSettingsService)
    repositories = setup.getAllRepositories()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
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

      const memberships = await repositories.userMembershipRepository.find({
        where: { resourceType: "agent", resourceId: agent.id },
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

  describe("updateAgentName", () => {
    it("should update an Agent name and leave its settings untouched", async () => {
      const { organization, project, agent, agentSettings } =
        await createOrganizationWithAgent(repositories)

      const isUpdated = await service.updateAgentName({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        name: "Updated Template",
      })

      expect(isUpdated).toBeTruthy()

      const updatedAgent = await repositories.agentRepository.findOne({
        where: { id: agent.id },
      })
      expect(updatedAgent?.name).toBe("Updated Template")

      // Renaming an agent must not create a new settings revision.
      const lastAgentSettings = await agentSettingsService.getLast({
        connectScope: { organizationId: organization.id, projectId: project.id },
        agentId: agent.id,
        includesDraft: true,
      })
      expect(lastAgentSettings.revision).toBe(agentSettings.revision)
      expect(lastAgentSettings.isDraft).toBeFalsy()
    })

    it("should throw UnprocessableEntityException when name is less than 3 characters", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories)

      const updateWithTooShortName = async () =>
        service.updateAgentName({
          connectScope: { organizationId: organization.id, projectId: project.id },
          agentId: agent.id,
          name: "AB",
        })

      await expect(updateWithTooShortName()).rejects.toThrow(UnprocessableEntityException)
      await expect(updateWithTooShortName()).rejects.toThrow(
        "Agent name must be at least 3 characters long",
      )
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

    it("should soft-delete agent memberships when deleting an agent", async () => {
      const { agent } = await createOrganizationWithAgent(repositories)

      await service.deleteAgent(agent)

      const activeMemberships = await repositories.userMembershipRepository.find({
        where: { resourceType: "agent", resourceId: agent.id },
      })
      expect(activeMemberships).toHaveLength(0)

      const softDeletedMemberships = await repositories.userMembershipRepository.find({
        where: { resourceType: "agent", resourceId: agent.id },
        withDeleted: true,
      })
      expect(softDeletedMemberships.length).toBeGreaterThan(0)
      expect(softDeletedMemberships.every((membership) => membership.deletedAt !== null)).toBe(true)
    })
  })
})
