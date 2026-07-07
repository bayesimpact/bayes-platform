import type { Agent } from "@/domains/agents/agent.entity"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentMembershipFactory } from "@/domains/agents/memberships/agent-membership.factory"
import { organizationMembershipFactory } from "@/domains/organizations/memberships/organization-membership.factory"
import type { OrganizationMembershipRole } from "@/domains/organizations/memberships/organization-membership.types"
import type { Organization } from "@/domains/organizations/organization.entity"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { projectMembershipFactory } from "@/domains/projects/memberships/project-membership.factory"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import type { Project } from "@/domains/projects/project.entity"
import { projectFactory } from "@/domains/projects/project.factory"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"

export type ResourceState = "sameOrganization" | "differentOrganization" | "noResource"

export function testPolicyScopedByProject<Policy, ResourceEntity>({
  buildResource,
  ResourcePolicy,
}: {
  buildResource: ({
    organization,
    projectRole,
    project,
    user,
  }: {
    organization: Organization
    project: Project
    user: User
    projectRole?: ProjectMembershipRole
  }) => ResourceEntity
  ResourcePolicy: new (
    // biome-ignore lint/suspicious/noExplicitAny: test prupose
    ...args: any[]
  ) => Policy
}) {
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

  const buildProject = (resourceState: ResourceState): Project => {
    if (resourceState === "differentOrganization") {
      return projectFactory.transient({ organization: otherOrganization }).build()
    }
    return projectFactory.transient({ organization }).build()
  }
  const buildAgent = (resourceState: ResourceState, project: Project): Agent => {
    if (resourceState === "differentOrganization") {
      return agentFactory.transient({ organization: otherOrganization, project }).build()
    }
    return agentFactory.transient({ organization, project }).build()
  }

  const buildPolicy = ({
    projectRole,
    resourceState,
    options,
    withAgentMembership,
  }: {
    projectRole?: ProjectMembershipRole
    resourceState: ResourceState
    options?: ConstructorParameters<typeof ResourcePolicy>[2]
    withAgentMembership?: boolean
  }) => {
    const organizationMembership = buildOrganizationMembership("member")
    const project = buildProject(resourceState)
    const projectMembership = projectRole
      ? buildProjectMembership({ role: projectRole, project })
      : undefined

    const agent = buildAgent(resourceState, project)

    const resource =
      resourceState === "noResource"
        ? undefined
        : withAgentMembership
          ? agent
          : buildResource({ organization, project, user, projectRole })

    const agentMembership = withAgentMembership
      ? agentMembershipFactory.transient({ user, agent }).build({ role: projectRole ?? "member" })
      : undefined

    return new ResourcePolicy(
      { organizationMembership, projectMembership, project, agentMembership },
      resource,
      options,
    )
  }

  return { buildPolicy }
}
