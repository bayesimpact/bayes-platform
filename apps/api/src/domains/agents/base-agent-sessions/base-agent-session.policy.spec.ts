import type { BaseAgentSessionTypeDto } from "@caseai-connect/api-contracts"
import {
  type ResourceState,
  testPolicyScopedByProject,
} from "@/common/test/test-project-scoped-policy.helpers"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import { BaseAgentSessionPolicy } from "./base-agent-session.policy"

describe("BaseAgentSessionPolicy", () => {
  const { buildPolicy } = testPolicyScopedByProject({
    buildResource: () => undefined,
    ResourcePolicy: BaseAgentSessionPolicy,
  })

  describe.each<[BaseAgentSessionTypeDto, Array<[ProjectMembershipRole, ResourceState, boolean]>]>([
    [
      "live",
      [
        ["owner", "sameOrganization", true],
        ["owner", "differentOrganization", false],
        ["owner", "noResource", true],
        ["admin", "sameOrganization", true],
        ["admin", "differentOrganization", false],
        ["admin", "noResource", true],
        ["member", "sameOrganization", true],
        ["member", "differentOrganization", false],
        ["member", "noResource", true],
      ],
    ],
    [
      "playground",
      [
        ["owner", "sameOrganization", true],
        ["owner", "differentOrganization", false],
        ["owner", "noResource", true],
        ["admin", "sameOrganization", true],
        ["admin", "differentOrganization", false],
        ["admin", "noResource", true],
        ["member", "sameOrganization", false],
        ["member", "differentOrganization", false],
        ["member", "noResource", false],
      ],
    ],
  ])('type: "%s"', (type, cases) => {
    describe.each<[string, (policy: BaseAgentSessionPolicy) => boolean]>([
      ["canList", (policy) => policy.canList()],
      ["canCreate", (policy) => policy.canCreate()],
    ])("%s", (_method, check) => {
      describe.each<[ProjectMembershipRole, ResourceState, boolean]>(
        cases,
      )("when user is %s with %s session", (projectRole, resourceState, expected) => {
        it(`should return ${expected}`, () => {
          const policy = buildPolicy({ projectRole, resourceState, options: type })
          expect(check(policy)).toBe(expected)
        })
      })
    })
  })
})
