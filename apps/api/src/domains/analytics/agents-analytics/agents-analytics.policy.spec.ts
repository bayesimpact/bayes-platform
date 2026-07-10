import { agentFactory } from "@/domains/agents/agent.factory"
import { agentMembershipFactory } from "@/domains/agents/memberships/agent-membership.factory"
import type { AgentMembershipRole } from "@/domains/agents/memberships/agent-membership.types"
import { organizationMembershipFactory } from "@/domains/organizations/memberships/organization-membership.factory"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { projectMembershipFactory } from "@/domains/projects/memberships/project-membership.factory"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import { userFactory } from "@/domains/users/user.factory"
import { AgentsAnalyticsPolicy } from "./agents-analytics.policy"

describe("AgentsAnalyticsPolicy", () => {
  const organization = organizationFactory.build()
  const user = userFactory.build()
  const organizationMembership = organizationMembershipFactory
    .transient({ user, organization })
    .params({ role: "member" })
    .build()

  const buildPolicy = ({
    projectRole,
    agentMembershipRole,
    includeAgentMembership,
  }: {
    projectRole: ProjectMembershipRole
    agentMembershipRole?: AgentMembershipRole
    includeAgentMembership: boolean
  }) => {
    const project = projectFactory.transient({ organization }).build()
    const projectMembership = projectMembershipFactory
      .transient({ user, project })
      .params({ role: projectRole })
      .build()
    const agent = agentFactory.transient({ organization, project }).build()
    const agentMembership = includeAgentMembership
      ? agentMembershipFactory
          .transient({ user, agent })
          .params({ role: agentMembershipRole ?? "member" })
          .build()
      : undefined

    return new AgentsAnalyticsPolicy(
      {
        organizationMembership,
        projectMembership,
        agentMembership,
      },
      agent,
    )
  }

  describe("canList", () => {
    it("returns true when the user is an agent owner (even as a project member)", () => {
      const policy = buildPolicy({
        projectRole: "member",
        agentMembershipRole: "owner",
        includeAgentMembership: true,
      })
      expect(policy.canList()).toBe(true)
    })

    it("returns true when the user is an agent owner and project owner", () => {
      const policy = buildPolicy({
        projectRole: "owner",
        agentMembershipRole: "owner",
        includeAgentMembership: true,
      })
      expect(policy.canList()).toBe(true)
    })

    it("returns false when the user is a project owner but has no agent membership", () => {
      const policy = buildPolicy({
        projectRole: "owner",
        includeAgentMembership: false,
      })
      expect(policy.canList()).toBe(false)
    })

    it("returns true when the user is a project owner but only agent admin", () => {
      const policy = buildPolicy({
        projectRole: "owner",
        agentMembershipRole: "admin",
        includeAgentMembership: true,
      })
      expect(policy.canList()).toBe(true)
    })

    it("returns true when the user is a project admin and agent admin", () => {
      const policy = buildPolicy({
        projectRole: "admin",
        agentMembershipRole: "admin",
        includeAgentMembership: true,
      })
      expect(policy.canList()).toBe(true)
    })

    it("returns false when the user is a project member and agent member (not owner)", () => {
      const policy = buildPolicy({
        projectRole: "member",
        agentMembershipRole: "member",
        includeAgentMembership: true,
      })
      expect(policy.canList()).toBe(false)
    })
  })
})
