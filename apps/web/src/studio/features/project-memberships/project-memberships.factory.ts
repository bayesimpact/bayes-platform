import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"
import type { Project } from "@/common/features/projects/projects.models"
import type {
  ProjectMemberAgent,
  ProjectMembership,
  ProjectRole,
} from "./project-memberships.models"

/** The `project` roles of the RBAC catalog, in catalog order, as the API names them. */
export const SAMPLE_PROJECT_ROLES: ProjectRole[] = [
  { key: "project_owner", name: "Project Owner" },
  { key: "project_admin", name: "Project Admin" },
  { key: "project_member", name: "Project Member" },
]

/** The catalog role of an owner / admin / member shorthand. */
export function sampleProjectRole(role: LegacyMembershipRole): ProjectRole {
  const projectRole = SAMPLE_PROJECT_ROLES.find(({ key }) => key === `project_${role}`)
  if (!projectRole) throw new Error(`Unknown project role ${role}`)
  return projectRole
}

const SAMPLE_PROJECT_ROLE_PERMISSIONS: Record<LegacyMembershipRole, string[]> = {
  owner: [
    "project.read",
    "project.update",
    "project.delete",
    "project.member.invite",
    "project.member.update",
    "review_campaign.report.read",
    "studio.ui.read",
    "desk.ui.read",
    "agent.create",
    "document.read",
    "document.create",
    "document.update",
    "document.delete",
    "csv_extraction_run.read",
    "csv_extraction_run.create",
    "resource_library.read",
    "user.read",
  ],
  admin: [
    "project.read",
    "project.update",
    "project.delete",
    "project.member.invite",
    "project.member.update",
    "review_campaign.report.read",
    "studio.ui.read",
    "desk.ui.read",
    "agent.create",
    "document.read",
    "document.create",
    "document.update",
    "document.delete",
    "csv_extraction_run.read",
    "csv_extraction_run.create",
    "resource_library.read",
    "user.read",
  ],
  member: ["project.read", "desk.ui.read"],
}

const SAMPLE_AGENT_ROLE_PERMISSIONS: Record<NonNullable<ProjectMemberAgent["role"]>, string[]> = {
  owner: ["agent.read", "agent.update", "agent.delete", "agent.member.invite"],
  admin: ["agent.read", "agent.update", "agent.delete", "agent.member.invite"],
  member: ["agent.read"],
}

type MembershipTransientParams = {
  project: Project
  /** The member's one role, when `roles` is not given. Member by default. */
  role: LegacyMembershipRole
}

class ProjectMembershipFactory extends Factory<ProjectMembership, MembershipTransientParams> {}

export const projectMembershipFactory = ProjectMembershipFactory.define(
  ({ params, transientParams }) => {
    const { project } = transientParams
    if (!project) {
      throw new Error(
        "Project must be provided in transient params to build a studio ProjectMembership",
      )
    }
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const role = transientParams.role ?? "member"
    return {
      projectId: project.id,
      userId: params.userId ?? faker.string.uuid(),
      userName: params.userName ?? `${firstName} ${lastName}`,
      userEmail: params.userEmail ?? faker.internet.email({ firstName, lastName }).toLowerCase(),
      userHasSignedIn: params.userHasSignedIn ?? true,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      roles: [sampleProjectRole(role)],
      permissions: SAMPLE_PROJECT_ROLE_PERMISSIONS[role],
    } satisfies ProjectMembership
  },
)

type MemberAgentTransientParams = {
  agent: Agent
}

class ProjectMemberAgentFactory extends Factory<ProjectMemberAgent, MemberAgentTransientParams> {}

export const projectMemberAgentFactory = ProjectMemberAgentFactory.define(
  ({ params, transientParams }) => {
    const { agent } = transientParams
    if (!agent) {
      throw new Error("Agent must be provided in transient params to build a ProjectMemberAgent")
    }
    const role = params.role === undefined ? "member" : params.role
    return {
      agentId: params.agentId ?? agent.id,
      agentName: params.agentName ?? agent.name,
      agentType: params.agentType ?? agent.type,
      role,
      permissions: params.permissions ?? (role ? SAMPLE_AGENT_ROLE_PERMISSIONS[role] : []),
    } satisfies ProjectMemberAgent
  },
)
