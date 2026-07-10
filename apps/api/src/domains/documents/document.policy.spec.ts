import {
  type ResourceState,
  testPolicyScopedByProject,
} from "@/common/test/test-project-scoped-policy.helpers"
import type { Organization } from "../organizations/organization.entity"
import type { ProjectMembershipRole } from "../projects/memberships/project-membership.types"
import type { Project } from "../projects/project.entity"
import { documentFactory } from "./document.factory"
import { DocumentPolicy } from "./document.policy"

describe("DocumentPolicy", () => {
  const { buildPolicy } = testPolicyScopedByProject({
    buildResource: (params: { organization: Organization; project: Project }) => {
      return documentFactory.transient(params).build()
    },
    ResourcePolicy: DocumentPolicy,
  })

  describe("canList", () => {
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
    ])("when user is %s with %s document", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(policy.canList()).toBe(expected)
      })
    })
  })

  describe("canCreate", () => {
    it.skip("allows members for non-project source types", () => {
      const defaultPolicy = buildPolicy({
        resourceState: "sameOrganization",
        projectRole: "member",
      })
      const agentSessionPolicy = buildPolicy({
        resourceState: "sameOrganization",
        projectRole: "member",
        options: "agentSessionMessage",
      })
      const extractionPolicy = buildPolicy({
        resourceState: "sameOrganization",
        projectRole: "member",
        options: "extraction",
      })
      expect(defaultPolicy.canCreate()).toBe(false)
      expect(agentSessionPolicy.canCreate()).toBe(true)
      expect(extractionPolicy.canCreate()).toBe(false)
    })

    it("forbids members for project source type", () => {
      const policy = buildPolicy({
        resourceState: "sameOrganization",
        projectRole: "member",
        options: "project",
      })
      expect(policy.canCreate()).toBe(false)
    })

    it("allows owners and admins for project source type", () => {
      const ownerPolicy = buildPolicy({
        resourceState: "sameOrganization",
        projectRole: "owner",
        options: "project",
      })
      const adminPolicy = buildPolicy({
        resourceState: "sameOrganization",
        projectRole: "admin",
        options: "project",
      })
      expect(ownerPolicy.canCreate()).toBe(true)
      expect(adminPolicy.canCreate()).toBe(true)
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
    ])("when user is %s with %s document", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
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
    ])("when user is %s with %s document", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })
        expect(policy.canDelete()).toBe(expected)
      })
    })
  })
})
