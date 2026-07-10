import {
  type ResourceState,
  testPolicyScopedByProject,
} from "@/common/test/test-project-scoped-policy.helpers"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import type { Project } from "@/domains/projects/project.entity"
import { ProjectsAnalyticsPolicy } from "./projects-analytics.policy"

describe("ProjectsAnalyticsPolicy", () => {
  const { buildPolicy } = testPolicyScopedByProject<ProjectsAnalyticsPolicy, Project>({
    buildResource: ({ project }) => project,
    ResourcePolicy: ProjectsAnalyticsPolicy,
  })

  describe("canList", () => {
    describe.each<[ProjectMembershipRole, ResourceState, boolean]>([
      ["owner", "sameOrganization", true],
      ["owner", "differentOrganization", true],
      ["owner", "noResource", false],
      ["admin", "sameOrganization", true],
      ["admin", "differentOrganization", true],
      ["admin", "noResource", false],
      ["member", "sameOrganization", false],
      ["member", "differentOrganization", false],
      ["member", "noResource", false],
    ])("when user is %s with %s project", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(policy.canList()).toBe(expected)
      })
    })
  })
})
