import type { ProjectParamsDto, ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"

export const campaignKeys = {
  all: ["campaigns"] as const,
  ofProject: (project: ProjectParamsDto) =>
    [...campaignKeys.all, "project", project.organizationId, project.projectId] as const,
  detail: (campaign: ReviewCampaignParamsDto) =>
    [...campaignKeys.all, "detail", campaign.reviewCampaignId] as const,
  invitations: (campaign: ReviewCampaignParamsDto) =>
    [...campaignKeys.all, "invitations", campaign.reviewCampaignId] as const,
}
