import { agentFactory } from "@/domains/agents/agent.factory"
import { agentMembershipFactory } from "@/domains/agents/memberships/agent-membership.factory"
import { organizationMembershipFactory } from "@/domains/organizations/memberships/organization-membership.factory"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.entity"
import { projectMembershipFactory } from "@/domains/projects/memberships/project-membership.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import type { InvitationTargetType } from "./invitation.entity"
import type { InvitationTarget } from "./invitation.policy"
import { InvitationPolicy } from "./invitation.policy"

const organization = organizationFactory.build()
const otherOrganization = organizationFactory.build()
const user = userFactory.build()
const project = projectFactory.transient({ organization }).build()
const projectInDifferentOrg = projectFactory.transient({ organization: otherOrganization }).build()
const agent = agentFactory.transient({ organization, project }).build()
const agentInDifferentOrg = agentFactory
  .transient({ organization: otherOrganization, project: projectInDifferentOrg })
  .build()
const reviewCampaign = reviewCampaignFactory.transient({ organization, project, agent }).build()
const reviewCampaignInDifferentOrg = reviewCampaignFactory
  .transient({
    organization: otherOrganization,
    project: projectInDifferentOrg,
    agent: agentInDifferentOrg,
  })
  .build()

const buildOrgMembership = () =>
  organizationMembershipFactory.transient({ user, organization }).params({ role: "member" }).build()

const buildProjectMembership = (role: ProjectMembershipRole) =>
  projectMembershipFactory.transient({ user, project }).params({ role }).build()

const buildPolicy = (
  targetType: InvitationTargetType,
  projectRole: ProjectMembershipRole | undefined,
  target: unknown,
  withAgentMembership = false,
  agentRole: "owner" | "admin" | "member" = "owner",
) => {
  const organizationMembership = buildOrgMembership()
  const projectMembership = projectRole ? buildProjectMembership(projectRole) : undefined
  const agentMembership =
    withAgentMembership && target && typeof target === "object" && "id" in target
      ? agentMembershipFactory
          .transient({ user, agent: target as typeof agent })
          .params({ role: agentRole })
          .build()
      : undefined

  return new InvitationPolicy(
    { organizationMembership, projectMembership, project, agentMembership },
    undefined,
    targetType,
    target as InvitationTarget | undefined,
  )
}

// ─── project target ──────────────────────────────────────────────────────────

describe("InvitationPolicy — targetType: project", () => {
  describe.each<["canList" | "canCreate" | "canDelete"]>([
    ["canList"],
    ["canCreate"],
    ["canDelete"],
  ])("%s", (action) => {
    describe.each<[ProjectMembershipRole, typeof project | typeof projectInDifferentOrg, boolean]>([
      ["owner", project, true],
      ["owner", projectInDifferentOrg, false],
      ["admin", project, true],
      ["admin", projectInDifferentOrg, false],
      ["member", project, false],
      ["member", projectInDifferentOrg, false],
    ])("when user is %s targeting %p", (projectRole, target, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy("project", projectRole, target)
        expect(policy[action]()).toBe(expected)
      })
    })

    it("allows admin with no target loaded (canList pre-load)", () => {
      const policy = buildPolicy("project", "admin", undefined)
      expect(policy[action]()).toBe(true)
    })

    it("denies member with no target loaded", () => {
      const policy = buildPolicy("project", "member", undefined)
      expect(policy[action]()).toBe(false)
    })
  })
})

// ─── agent target ─────────────────────────────────────────────────────────────

describe("InvitationPolicy — targetType: agent", () => {
  describe.each<["canList" | "canCreate" | "canDelete"]>([
    ["canList"],
    ["canCreate"],
    ["canDelete"],
  ])("%s", (action) => {
    describe.each<
      ["owner" | "admin" | "member", typeof agent | typeof agentInDifferentOrg, boolean]
    >([
      ["owner", agent, true],
      ["owner", agentInDifferentOrg, false],
      ["admin", agent, true],
      ["admin", agentInDifferentOrg, false],
      ["member", agent, false],
      ["member", agentInDifferentOrg, false],
    ])("when agent membership role is %s targeting %p", (agentRole, target, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy("agent", "member", target, true, agentRole)
        expect(policy[action]()).toBe(expected)
      })
    })

    it("denies when the user has no agent membership", () => {
      const policy = buildPolicy("agent", "admin", agent, false)
      expect(policy[action]()).toBe(false)
    })
  })
})

// ─── review_campaign target ───────────────────────────────────────────────────

describe("InvitationPolicy — targetType: review_campaign", () => {
  describe.each<["canList" | "canCreate" | "canDelete"]>([
    ["canList"],
    ["canCreate"],
    ["canDelete"],
  ])("%s", (action) => {
    describe.each<
      [ProjectMembershipRole, typeof reviewCampaign | typeof reviewCampaignInDifferentOrg, boolean]
    >([
      ["owner", reviewCampaign, true],
      ["owner", reviewCampaignInDifferentOrg, false],
      ["admin", reviewCampaign, true],
      ["admin", reviewCampaignInDifferentOrg, false],
      ["member", reviewCampaign, false],
      ["member", reviewCampaignInDifferentOrg, false],
    ])("when user is %s targeting %p", (projectRole, target, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy("review_campaign", projectRole, target)
        expect(policy[action]()).toBe(expected)
      })
    })

    it("allows admin with no target loaded", () => {
      const policy = buildPolicy("review_campaign", "admin", undefined)
      expect(policy[action]()).toBe(true)
    })

    it("denies member with no target loaded", () => {
      const policy = buildPolicy("review_campaign", "member", undefined)
      expect(policy[action]()).toBe(false)
    })
  })
})
