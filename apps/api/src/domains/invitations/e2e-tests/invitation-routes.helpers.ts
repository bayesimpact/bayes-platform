import {
  AgentInvitationsRoutes,
  ProjectInvitationsRoutes,
  ReviewCampaignInvitationsRoutes,
} from "@caseai-connect/api-contracts"

type ProjectLike = { id: string; organizationId: string }
type ScopedLike = { id: string; organizationId: string; projectId: string }

export type InvitationRouteTarget =
  | { project: ProjectLike }
  | { agent: ScopedLike }
  | { reviewCampaign: ScopedLike }

type InvitationRoutes =
  | typeof ProjectInvitationsRoutes
  | typeof AgentInvitationsRoutes
  | typeof ReviewCampaignInvitationsRoutes

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
  if ("agent" in target) {
    return {
      routes: AgentInvitationsRoutes,
      pathParams: {
        organizationId: target.agent.organizationId,
        projectId: target.agent.projectId,
        agentId: target.agent.id,
      },
    }
  }
  return {
    routes: ReviewCampaignInvitationsRoutes,
    pathParams: {
      organizationId: target.reviewCampaign.organizationId,
      projectId: target.reviewCampaign.projectId,
      reviewCampaignId: target.reviewCampaign.id,
    },
  }
}
