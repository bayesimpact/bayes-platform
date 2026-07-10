import { organizationMembershipFactory } from "@/domains/organizations/memberships/organization-membership.factory"
import type { OrganizationMembershipRole } from "@/domains/organizations/memberships/organization-membership.types"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import type { Organization } from "../organizations/organization.entity"
import { projectMembershipFactory } from "./memberships/project-membership.factory"
import type { ProjectMembershipRole } from "./memberships/project-membership.types"
import { projectFactory } from "./project.factory"
import { ProjectPolicy } from "./project.policy"

type Project = ReturnType<typeof projectFactory.build>
type ResourceState = "sameOrganization" | "differentOrganization" | "noResource"

describe("ProjectPolicy", () => {
  const organization = organizationFactory.build()
  const otherOrganization = organizationFactory.build()
  const user = userFactory.build()

  const buildOrganizationMembership = (role: OrganizationMembershipRole) => {
    return organizationMembershipFactory.transient({ user, organization }).params({ role }).build()
  }
  const buildProjectMembership = ({
    role,
    project,
  }: {
    role: ProjectMembershipRole
    project: Project
  }) => {
    return projectMembershipFactory.transient({ user, project }).params({ role }).build()
  }

  const buildProject = (projectOrganization: Organization) => {
    return projectFactory.transient({ organization: projectOrganization }).build()
  }

  const buildResource = (resourceState: ResourceState): Project | undefined => {
    if (resourceState === "sameOrganization") {
      return buildProject(organization)
    }
    if (resourceState === "differentOrganization") {
      return buildProject(otherOrganization)
    }
    return undefined
  }

  const buildPolicy = ({
    organizationRole,
    projectRole,
    resourceState,
  }: {
    organizationRole: OrganizationMembershipRole
    projectRole?: ProjectMembershipRole
    resourceState: ResourceState
  }) => {
    const project = buildResource(resourceState)
    return new ProjectPolicy(
      {
        organizationMembership: buildOrganizationMembership(organizationRole),
        projectMembership:
          project && projectRole
            ? buildProjectMembership({ role: projectRole, project })
            : undefined,
      },
      project,
    )
  }

  describe("canList", () => {
    describe.each<[OrganizationMembershipRole, ResourceState]>([
      ["owner", "sameOrganization"],
      ["owner", "differentOrganization"],
      ["owner", "noResource"],
      ["admin", "sameOrganization"],
      ["admin", "differentOrganization"],
      ["admin", "noResource"],
      ["member", "sameOrganization"],
      ["member", "differentOrganization"],
      ["member", "noResource"],
    ])("when user is %s of the organization with %s project", (role, resourceState) => {
      it("should always return true", () => {
        const policy = buildPolicy({ organizationRole: role, resourceState })
        expect(policy.canList()).toBe(true)
      })
    })
  })

  describe("canCreate", () => {
    it("should return true when user is owner of the organization", () => {
      const policy = buildPolicy({ organizationRole: "owner", resourceState: "noResource" })
      expect(policy.canCreate()).toBe(true)
    })

    it("should return true when user is admin of the organization", () => {
      const policy = buildPolicy({ organizationRole: "admin", resourceState: "noResource" })
      expect(policy.canCreate()).toBe(true)
    })

    it("should return false when user is member of the organization", () => {
      const policy = buildPolicy({ organizationRole: "member", resourceState: "noResource" })
      expect(policy.canCreate()).toBe(false)
    })
  })

  describe("canUpdate", () => {
    describe.each<[OrganizationMembershipRole, ResourceState, boolean]>([
      ["owner", "sameOrganization", true],
      ["owner", "differentOrganization", false],
      ["owner", "noResource", false],
      ["admin", "sameOrganization", true],
      ["admin", "differentOrganization", false],
      ["admin", "noResource", false],
      ["member", "sameOrganization", false],
      ["member", "differentOrganization", false],
      ["member", "noResource", false],
    ])("when user is %s of the project with %s project", (role, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ organizationRole: "member", resourceState, projectRole: role })
        expect(policy.canUpdate()).toBe(expected)
      })
    })
  })

  describe("canDelete", () => {
    describe.each<[OrganizationMembershipRole, ResourceState, boolean]>([
      ["owner", "sameOrganization", true],
      ["owner", "differentOrganization", false],
      ["owner", "noResource", false],
      ["admin", "sameOrganization", true],
      ["admin", "differentOrganization", false],
      ["admin", "noResource", false],
      ["member", "sameOrganization", false],
      ["member", "differentOrganization", false],
      ["member", "noResource", false],
    ])("when user is %s of the project with %s project", (role, resourceState, expected) => {
      it(`should return ${expected}`, () => {
        const policy = buildPolicy({ organizationRole: "member", resourceState, projectRole: role })
        expect(policy.canDelete()).toBe(expected)
      })
    })
  })
})
