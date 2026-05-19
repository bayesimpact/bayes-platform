import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { Project } from "@/common/features/projects/projects.models"
import type { ProjectMemberAgent, ProjectMembership } from "./project-memberships.models"

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
    return {
      id: params.id ?? faker.string.uuid(),
      projectId: project.id,
      userId: params.userId ?? faker.string.uuid(),
      userName: params.userName ?? `${firstName} ${lastName}`,
      userEmail: params.userEmail ?? faker.internet.email({ firstName, lastName }).toLowerCase(),
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      role: params.role ?? "member",
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
