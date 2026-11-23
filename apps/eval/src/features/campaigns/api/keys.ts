import type {
  AgentParamsDto,
  ProjectParamsDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"

export const campaignKeys = {
  all: ["campaigns"] as const,
  ofProject: (project: ProjectParamsDto) =>
    [...campaignKeys.all, "project", project.organizationId, project.projectId] as const,
  detail: (campaign: ReviewCampaignParamsDto) =>
    [...campaignKeys.all, "detail", campaign.reviewCampaignId] as const,
  invitations: (campaign: ReviewCampaignParamsDto) =>
    [...campaignKeys.all, "invitations", campaign.reviewCampaignId] as const,
  agentVersions: (agent: AgentParamsDto) =>
    [...campaignKeys.all, "agent-versions", agent.agentId] as const,
}
