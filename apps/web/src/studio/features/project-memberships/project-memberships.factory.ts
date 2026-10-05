import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { Project } from "@/common/features/projects/projects.models"
import type { ProjectMemberAgent, ProjectMembership } from "./project-memberships.models"

const SAMPLE_PROJECT_ROLE_PERMISSIONS: Record<ProjectMembership["role"], string[]> = {
  owner: ["project.read", "project.update", "project.delete", "agent.create", "document.read"],
  admin: ["project.read", "project.update", "project.delete", "agent.create", "document.read"],
  member: ["project.read", "desk.ui.read"],
}

type MembershipTransientParams = {
  project: Project
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
    const role = params.role ?? "member"
    return {
      id: params.id ?? faker.string.uuid(),
      projectId: project.id,
      userId: params.userId ?? faker.string.uuid(),
      userName: params.userName ?? `${firstName} ${lastName}`,
      userEmail: params.userEmail ?? faker.internet.email({ firstName, lastName }).toLowerCase(),
      userHasSignedIn: params.userHasSignedIn ?? true,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      role,
      roleKey: params.roleKey === undefined ? `project_${role}` : params.roleKey,
      permissions: params.permissions ?? SAMPLE_PROJECT_ROLE_PERMISSIONS[role],
    } satisfies ProjectMembership
  },
)

type MemberAgentTransientParams = {
  agent: Agent
  membership?: ProjectMembership
}

class ProjectMemberAgentFactory extends Factory<ProjectMemberAgent, MemberAgentTransientParams> {}

export const projectMemberAgentFactory = ProjectMemberAgentFactory.define(
  ({ params, transientParams }) => {
    const { agent, membership } = transientParams
    if (!agent) {
      throw new Error("Agent must be provided in transient params to build a ProjectMemberAgent")
    }
    return {
      agentId: params.agentId ?? agent.id,
      agentName: params.agentName ?? agent.name,
      agentType: params.agentType ?? agent.type,
      membershipId: params.membershipId ?? membership?.id ?? null,
      role: params.role ?? "member",
    } satisfies ProjectMemberAgent
  },
)
