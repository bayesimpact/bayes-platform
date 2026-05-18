import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent, createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AgentsModule } from "../agents.module"
import { addUserToAgent } from "./agent-membership.factory"
import { AgentMembershipsService } from "./agent-memberships.service"

describe("AgentMembershipsService", () => {
  let service: AgentMembershipsService
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
    service = setup.module.get(AgentMembershipsService)
    repositories = setup.getAllRepositories()
  })

  // ─── removeAgentMembership ────────────────────────────────────────────────

  describe("removeAgentMembership", () => {
    it("removes the agent membership", async () => {
      const { agent, user, project } = await createOrganizationWithAgent(repositories)
      const { membership, user: member } = await addUserToAgent({ repositories, agent })
      await addUserToProject({ repositories, project, user: member })

      await service.removeAgentMembership({
        userId: user.id,
        membershipId: membership.id,
        agentId: agent.id,
      })

      const remaining = await repositories.agentMembershipRepository.findOne({
        where: { id: membership.id },
      })
      expect(remaining).toBeNull()
    })

    it("does NOT remove the project membership when an agent membership is removed", async () => {
      const { agent, user, project } = await createOrganizationWithAgent(repositories)
      const { membership, user: member } = await addUserToAgent({ repositories, agent })
      await addUserToProject({ repositories, project, user: member })

      await service.removeAgentMembership({
        userId: user.id,
        membershipId: membership.id,
        agentId: agent.id,
      })

      const projectMembership = await repositories.projectMembershipRepository.findOne({
        where: { projectId: project.id, userId: member.id },
      })
      expect(projectMembership).not.toBeNull()
    })

    it("does NOT remove the organization membership regardless of remaining agent memberships", async () => {
      const { agent, user, organization, project } = await createOrganizationWithAgent(repositories)
      const { membership, user: member } = await addUserToAgent({ repositories, agent })
      await addUserToProject({ repositories, project, user: member })
      await repositories.organizationMembershipRepository.save(
        repositories.organizationMembershipRepository.create({
          userId: member.id,
          organizationId: organization.id,
          role: "member",
        }),
      )

      await service.removeAgentMembership({
        userId: user.id,
        membershipId: membership.id,
        agentId: agent.id,
      })

      const orgMembership = await repositories.organizationMembershipRepository.findOne({
        where: { organizationId: organization.id, userId: member.id },
      })
      expect(orgMembership).not.toBeNull()
    })

    it("throws when attempting to remove yourself", async () => {
      const { agent, user } = await createOrganizationWithAgent(repositories)
      const ownerMembership = await repositories.agentMembershipRepository.findOneOrFail({
        where: { agentId: agent.id, userId: user.id },
      })

      await expect(
        service.removeAgentMembership({
          userId: user.id,
          membershipId: ownerMembership.id,
          agentId: agent.id,
        }),
      ).rejects.toThrow("Cannot remove yourself from the agent")
    })

    it("throws when attempting to remove the owner", async () => {
      const { agent, user: requester } = await createOrganizationWithAgent(repositories)
      const { user: ownerUser } = await createOrganizationWithProject(repositories)
      const ownerMembership = await repositories.agentMembershipRepository.save(
        repositories.agentMembershipRepository.create({
          agentId: agent.id,
          userId: ownerUser.id,
          role: "owner",
        }),
      )

      await expect(
        service.removeAgentMembership({
          userId: requester.id,
          membershipId: ownerMembership.id,
          agentId: agent.id,
        }),
      ).rejects.toThrow("Cannot remove owner from the agent")
    })
  })
})
