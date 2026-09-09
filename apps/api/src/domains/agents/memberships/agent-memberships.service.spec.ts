import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { AGENT_ROLES } from "@/domains/rbac/rbac.constants"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { agentFactory } from "../agent.factory"
import { AgentsModule } from "../agents.module"
import {
  addUserToAgent,
  agentMembershipFactory,
  saveAgentMembership,
} from "./agent-membership.factory"
import { AgentMembershipsService } from "./agent-memberships.service"

describe("AgentMembershipsService", () => {
  let service: AgentMembershipsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
    })
    await ensureRbacCatalog(setup.module)
    service = setup.module.get(AgentMembershipsService)
    repositories = setup.getAllRepositories()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  describe("createAgentOwnerMembership", () => {
    it("creates an owner membership with the agent RBAC role_id", async () => {
      const { project, organization, user } = await createOrganizationWithProject(repositories)
      const agent = await repositories.agentRepository.save(
        agentFactory.transient({ project, organization }).build(),
      )

      const membership = await service.createAgentOwnerMembership({
        agentId: agent.id,
        userId: user.id,
      })

      expect(membership.role).toBe("owner")
      expect(membership.roleId).not.toBeNull()

      const savedMembership = await repositories.userMembershipRepository.findOneOrFail({
        where: { id: membership.id },
      })
      const agentOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: AGENT_ROLES.owner },
      })
      expect(savedMembership.roleId).toBe(agentOwnerRole.id)
    })
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

      const remaining = await repositories.userMembershipRepository.findOne({
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

      const projectMembership = await repositories.userMembershipRepository.findOne({
        where: {
          resourceType: "project",
          resourceId: project.id,
          userId: member.id,
        },
      })
      expect(projectMembership).not.toBeNull()
    })

    it("does NOT remove the organization membership regardless of remaining agent memberships", async () => {
      const { agent, user, organization, project } = await createOrganizationWithAgent(repositories)
      const { membership, user: member } = await addUserToAgent({ repositories, agent })
      await addUserToProject({ repositories, project, user: member })
      await saveOrgMembership({
        repositories,
        membership: organizationMembershipFactory
          .transient({ user: member, organization })
          .member()
          .build(),
      })

      await service.removeAgentMembership({
        userId: user.id,
        membershipId: membership.id,
        agentId: agent.id,
      })

      const orgMembership = await repositories.userMembershipRepository.findOne({
        where: {
          resourceType: "organization",
          resourceId: organization.id,
          userId: member.id,
        },
      })
      expect(orgMembership).not.toBeNull()
    })

    it("throws when attempting to remove yourself", async () => {
      const { agent, user } = await createOrganizationWithAgent(repositories)
      const ownerMembership = await repositories.userMembershipRepository.findOneOrFail({
        where: {
          resourceType: "agent",
          resourceId: agent.id,
          userId: user.id,
        },
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
      const ownerMembership = await saveAgentMembership({
        repositories,
        membership: agentMembershipFactory.transient({ agent, user: ownerUser }).owner().build(),
      })

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
