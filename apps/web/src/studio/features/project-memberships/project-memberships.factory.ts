import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"
import type { Project } from "@/common/features/projects/projects.models"
import type {
  AssignableRoles,
  HeldRole,
  MemberRoles,
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

/** The `agent` and `review_campaign` roles the member page offers, as the API names them. */
export const SAMPLE_AGENT_ROLES: ProjectRole[] = [
  { key: "agent_owner", name: "Agent Owner" },
  { key: "agent_admin", name: "Agent Admin" },
  { key: "agent_member", name: "Agent Member" },
]

export const SAMPLE_CAMPAIGN_ROLES: ProjectRole[] = [
  { key: "review_campaign_tester", name: "Review Campaign Tester" },
  { key: "review_campaign_reviewer", name: "Review Campaign Reviewer" },
]

/** The catalog roles offered on each kind of resource, as the API lists them. */
export const SAMPLE_ASSIGNABLE_ROLES: AssignableRoles = {
  project: SAMPLE_PROJECT_ROLES,
  agent: SAMPLE_AGENT_ROLES,
  review_campaign: SAMPLE_CAMPAIGN_ROLES,
}

const held = (role: ProjectRole): HeldRole => ({ ...role, membershipId: faker.string.uuid() })

type MemberRolesTransientParams = {
  membership: ProjectMembership
  projectName: string
  /** The project's agents; the member holds `agent_member` on the first one. */
  agents: Agent[]
}

class MemberRolesFactory extends Factory<MemberRoles, MemberRolesTransientParams> {}

/** A member's roles on the workspace and its agents, and one active campaign they test. */
export const memberRolesFactory = MemberRolesFactory.define(({ transientParams }) => {
  const { membership, projectName, agents = [] } = transientParams
  if (!membership) {
    throw new Error("Membership must be provided in transient params to build MemberRoles")
  }
  const memberRole = SAMPLE_AGENT_ROLES[2]
  const testerRole = SAMPLE_CAMPAIGN_ROLES[0]
  return {
    member: membership,
    workspace: {
      kind: "project",
      resourceId: membership.projectId,
      resourceName: projectName ?? faker.commerce.productName(),
      detail: null,
      roles: membership.roles.map(held),
      permissions: membership.permissions,
    },
    agents: agents.map((agent, index) => ({
      kind: "agent",
      resourceId: agent.id,
      resourceName: agent.name,
      detail: agent.type,
      roles: index === 0 && memberRole ? [held(memberRole)] : [],
      permissions: index === 0 ? ["agent.read"] : [],
    })),
    campaigns: testerRole
      ? [
          {
            kind: "review_campaign",
            resourceId: faker.string.uuid(),
            resourceName: faker.commerce.productName(),
            detail: "active",
            roles: [held(testerRole)],
            permissions: ["review_campaign.read"],
          },
        ]
      : [],
  } satisfies MemberRoles
})
