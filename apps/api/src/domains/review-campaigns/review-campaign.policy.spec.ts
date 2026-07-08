import {
  type ResourceState,
  testPolicyScopedByProject,
} from "@/common/test/test-project-scoped-policy.helpers"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { OrganizationMembershipRole } from "@/domains/organizations/memberships/organization-membership.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { ReviewCampaign } from "./review-campaign.entity"
import { reviewCampaignFactory } from "./review-campaign.factory"
import { ReviewCampaignPolicy } from "./review-campaign.policy"

describe("ReviewCampaignPolicy", () => {
  const { buildPolicy } = testPolicyScopedByProject<ReviewCampaignPolicy, ReviewCampaign>({
    buildResource: (params: { organization: Organization; project: Project }) => {
      const agent = agentFactory.transient(params).build()
      const agentSettings = agentSettingsFactory.transient({ ...params, agent }).build()
      return reviewCampaignFactory.transient({ ...params, agent, agentSettings }).build()
    },
    ResourcePolicy: ReviewCampaignPolicy,
  })

  describe("canList", () => {
    describe.each<[ProjectMembershipRole, ResourceState, boolean]>([
      ["owner", "sameOrganization", true],
      ["owner", "noResource", true],
      ["admin", "sameOrganization", true],
      ["admin", "noResource", true],
      ["member", "sameOrganization", false],
      ["member", "noResource", false],
    ])("when user is %s with %s campaign", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(policy.canList()).toBe(expected)
      })
    })
  })

  describe("canCreate", () => {
    describe.each<[ProjectMembershipRole, ResourceState, boolean]>([
      ["owner", "noResource", true],
      ["admin", "noResource", true],
      ["member", "noResource", false],
    ])("when user is %s", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(policy.canCreate()).toBe(expected)
      })
    })
  })

  describe("canView / canUpdate / canDelete", () => {
    describe.each<[OrganizationMembershipRole, ResourceState, boolean]>([
      ["owner", "sameOrganization", true],
      ["owner", "differentOrganization", false],
      ["owner", "noResource", false],
      ["admin", "sameOrganization", true],
      ["admin", "differentOrganization", false],
      ["admin", "noResource", false],
      ["member", "sameOrganization", false],
    ])("when user is %s with %s campaign", (projectRole: OrganizationMembershipRole, resourceState, expected) => {
      it(`canView returns ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(policy.canView()).toBe(expected)
      })
      it(`canUpdate returns ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(policy.canUpdate()).toBe(expected)
      })
      it(`canDelete returns ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(policy.canDelete()).toBe(expected)
      })
    })
  })
})
