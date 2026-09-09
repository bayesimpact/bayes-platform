import {
  type ResourceState,
  testPolicyScopedByProject,
} from "@/common/test/test-project-scoped-policy.helpers"
import { organizationMembershipFactory } from "@/domains/organizations/memberships/organization-membership.factory"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { projectMembershipFactory } from "@/domains/projects/memberships/project-membership.factory"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import { userFactory } from "@/domains/users/user.factory"
import { mcpServerFactory } from "./mcp-server.factory"
import { McpServerPolicy } from "./mcp-server.policy"

describe("McpServerPolicy", () => {
  const { buildPolicy } = testPolicyScopedByProject({
    buildResource: ({ project }) => mcpServerFactory.build({ projectId: project.id, project }),
    ResourcePolicy: McpServerPolicy,
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
    ])("when user is %s with %s MCP server", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })

        expect(policy.canList()).toBe(expected)
      })
    })

    it("should return false when the user is not a member of the project", () => {
      const policy = buildPolicy({ resourceState: "noResource" })

      expect(policy.canList()).toBe(false)
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
    ])("when user is %s with %s MCP server", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })

        expect(policy.canCreate()).toBe(expected)
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
    ])("when user is %s with %s MCP server", (projectRole, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ resourceState, projectRole })

        expect(policy.canDelete()).toBe(expected)
      })
    })
  })

  describe("resource scoping", () => {
    const organization = organizationFactory.build()
    const user = userFactory.build()
    const project = projectFactory.transient({ organization }).build()
    const otherProject = projectFactory.transient({ organization }).build()
    const context = {
      organizationMembership: organizationMembershipFactory
        .transient({ user, organization })
        .params({ role: "member" })
        .build(),
      projectMembership: projectMembershipFactory
        .transient({ user, project })
        .params({ role: "owner" })
        .build(),
      project,
    }

    it("should allow deleting a server of the current project", () => {
      const server = mcpServerFactory.build({ projectId: project.id })

      expect(new McpServerPolicy(context, server).canDelete()).toBe(true)
    })

    it("should deny deleting a server of another project in the same organization", () => {
      const server = mcpServerFactory.build({ projectId: otherProject.id })

      expect(new McpServerPolicy(context, server).canDelete()).toBe(false)
    })

    it("should deny deleting a preset server that belongs to no project", () => {
      const server = mcpServerFactory.preset("preset").build()

      expect(new McpServerPolicy(context, server).canDelete()).toBe(false)
    })

    it("should deny deleting when the resource is not an entity", () => {
      const policy = new McpServerPolicy(context, "not-an-entity" as never)

      expect(policy.canDelete()).toBe(false)
    })
  })
})
