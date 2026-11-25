import { AgentInvitationsRoutes, ProjectInvitationsRoutes } from "@caseai-connect/api-contracts"

type ProjectLike = { id: string; organizationId: string }
type ScopedLike = { id: string; organizationId: string; projectId: string }

export type InvitationRouteTarget = { project: ProjectLike } | { agent: ScopedLike }

type InvitationRoutes = typeof ProjectInvitationsRoutes | typeof AgentInvitationsRoutes

/** The admin invitation routes of a target, with the path params they need. */
export function invitationRoutesFor(target: InvitationRouteTarget): {
  routes: InvitationRoutes
  pathParams: Record<string, string>
} {
  if ("project" in target) {
    return {
      routes: ProjectInvitationsRoutes,
      pathParams: {
        organizationId: target.project.organizationId,
        projectId: target.project.id,
      },
    }
  }
  return {
    routes: AgentInvitationsRoutes,
    pathParams: {
      organizationId: target.agent.organizationId,
      projectId: target.agent.projectId,
      agentId: target.agent.id,
    },
  }
}
