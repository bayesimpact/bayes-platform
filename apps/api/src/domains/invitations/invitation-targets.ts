import type { InvitationTarget } from "./invitations.service"

/** Structural shapes, so this domain does not import other domains' entities. */
type ProjectLike = { id: string; organizationId: string }
type AgentLike = { id: string; organizationId: string; projectId: string }
type ReviewCampaignLike = AgentLike & { status: string }

export function projectInvitationTarget(project: ProjectLike): InvitationTarget {
  return {
    targetType: "project",
    targetId: project.id,
    organizationId: project.organizationId,
    projectId: project.id,
  }
}

export function agentInvitationTarget(agent: AgentLike): InvitationTarget {
  return {
    targetType: "agent",
    targetId: agent.id,
    organizationId: agent.organizationId,
    projectId: agent.projectId,
  }
}

export function reviewCampaignInvitationTarget(
  reviewCampaign: ReviewCampaignLike,
): InvitationTarget {
  return {
    targetType: "review_campaign",
    targetId: reviewCampaign.id,
    organizationId: reviewCampaign.organizationId,
    projectId: reviewCampaign.projectId,
    status: reviewCampaign.status,
  }
}
