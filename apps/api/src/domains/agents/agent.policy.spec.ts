import {
  type ResourceState,
  testPolicyScopedByProject,
} from "@/common/test/test-project-scoped-policy.helpers"
import type { ProjectMembershipRole } from "../projects/memberships/project-membership.types"
import { agentFactory } from "./agent.factory"
import { AgentPolicy } from "./agent.policy"

describe("AgentPolicy", () => {
  const { buildPolicy } = testPolicyScopedByProject({
    buildResource: (params) => {
      return agentFactory.transient(params).build()
    },
    ResourcePolicy: AgentPolicy,
  })

  describe("canList", () => {
    describe.each<[ProjectMembershipRole, ResourceState, boolean]>([
      ["owner", "sameOrganization", true],
      ["owner", "differentOrganization", false],
      ["owner", "noResource", true],
      ["admin", "sameOrganization", true],
      ["admin", "differentOrganization", false],
      ["admin", "noResource", true],
      ["member", "sameOrganization", true],
      ["member", "differentOrganization", false],
      ["member", "noResource", true],
    ])("when user is %s with %s agent", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })

        expect(policy.canList()).toBe(expected)
      })
    })
  })

  describe("canView", () => {
    describe.each<[ProjectMembershipRole, ResourceState, boolean, boolean]>([
      // Agent membership present: readable regardless of project or agent role, as long as the
      // resource is in scope. This is the case that distinguishes canView from canUpdate (which
      // additionally requires agent admin/owner).
      ["owner", "sameOrganization", true, true],
      ["admin", "sameOrganization", true, true],
      ["member", "sameOrganization", true, true],
      ["owner", "differentOrganization", true, false],
      ["member", "differentOrganization", true, false],
      ["owner", "noResource", true, false],
      ["member", "noResource", true, false],
      // No agent membership at all: denied even for a project owner or admin. This is the case
      // that distinguishes canView from canList (which is project-level access only).
      ["owner", "sameOrganization", false, false],
      ["admin", "sameOrganization", false, false],
      ["member", "sameOrganization", false, false],
    ])("when user is %s with %s agent and agent membership %s", (projectRole, resourceState, withAgentMembership, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole, withAgentMembership })

        expect(policy.canView()).toBe(expected)
      })
    })
  })

  describe("canCreate", () => {
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
    ])("when user is %s with %s agent", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(policy.canCreate()).toBe(expected)
      })
    })
  })

  describe("canUpdate", () => {
    describe.each<[ProjectMembershipRole, ResourceState, boolean]>([
      ["owner", "sameOrganization", true],
      ["owner", "differentOrganization", false],
      ["owner", "noResource", false],
      ["admin", "sameOrganization", true],
      ["admin", "differentOrganization", false],
      ["admin", "noResource", false],
      ["member", "sameOrganization", false],
      ["member", "differentOrganization", false],
      ["member", "noResource", false],
    ])("when user is %s with %s agent", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole, withAgentMembership: true })

        expect(policy.canUpdate()).toBe(expected)
      })
    })
  })

  describe("canDelete", () => {
    describe.each<[ProjectMembershipRole, ResourceState, boolean]>([
      ["owner", "sameOrganization", true],
      ["owner", "differentOrganization", false],
      ["owner", "noResource", false],
      ["admin", "sameOrganization", true],
      ["admin", "differentOrganization", false],
      ["admin", "noResource", false],
      ["member", "sameOrganization", false],
      ["member", "differentOrganization", false],
      ["member", "noResource", false],
    ])("when user is %s with %s agent", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole, withAgentMembership: true })

        expect(policy.canDelete()).toBe(expected)
      })
    })
  })
})
