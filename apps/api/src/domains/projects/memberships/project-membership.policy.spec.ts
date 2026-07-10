import {
  type ResourceState,
  testPolicyScopedByProject,
} from "@/common/test/test-project-scoped-policy.helpers"
import { userFactory } from "@/domains/users/user.factory"
import type { Organization } from "../../organizations/organization.entity"
import type { Project } from "../project.entity"
import { projectMembershipFactory } from "./project-membership.factory"
import { ProjectMembershipPolicy } from "./project-membership.policy"
import type { ProjectMembershipRole } from "./project-membership.types"

describe("ProjectMembershipPolicy", () => {
  const { buildPolicy } = testPolicyScopedByProject({
    buildResource: (params: { organization: Organization; project: Project }) => {
      const invitedUser = userFactory.build()
      return projectMembershipFactory
        .transient({ project: params.project, user: invitedUser })
        .build()
    },
    ResourcePolicy: ProjectMembershipPolicy,
  })

  describe.each<[string, (policy: ProjectMembershipPolicy) => boolean]>([
    ["canList", (policy) => policy.canList()],
    ["canCreate", (policy) => policy.canCreate()],
    ["canUpdate", (policy) => policy.canUpdate()],
    ["canDelete", (policy) => policy.canDelete()],
  ])("%s", (_method, check) => {
    describe.each<[ProjectMembershipRole, ResourceState, boolean]>([
      ["owner", "sameOrganization", true],
      ["owner", "differentOrganization", false],
      ["owner", "noResource", true],
      ["admin", "sameOrganization", true],
      ["admin", "differentOrganization", false],
      ["admin", "noResource", true],
      ["member", "sameOrganization", false],
      ["member", "differentOrganization", false],
      ["member", "noResource", false],
    ])("when user is %s with %s membership", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(check(policy)).toBe(expected)
      })
    })
  })
})
