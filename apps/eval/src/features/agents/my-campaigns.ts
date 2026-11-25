import type {
  MyReviewCampaignOutputDto,
  ReviewCampaignRoleDto,
} from "@bayes-platform/eval-contracts"

/** A review campaign the person takes part in, with every role they hold in it. */
export type MyCampaign = MyReviewCampaignOutputDto & {
  roles: ReviewCampaignRoleDto[]
}

/**
 * The campaigns the person tests and those they review, as one list sorted by name: a campaign
 * where they do both shows once, with both roles.
 */
export function mergeMyCampaigns(
  testerCampaigns: MyReviewCampaignOutputDto[],
  reviewerCampaigns: MyReviewCampaignOutputDto[],
): MyCampaign[] {
  const campaignsById = new Map<string, MyCampaign>()
  const entries = [
    ...testerCampaigns.map((campaign) => ({ campaign, role: "tester" as const })),
    ...reviewerCampaigns.map((campaign) => ({ campaign, role: "reviewer" as const })),
  ]
  for (const { campaign, role } of entries) {
    const known = campaignsById.get(campaign.id)
    if (known) known.roles.push(role)
    else campaignsById.set(campaign.id, { ...campaign, roles: [role] })
  }
  return [...campaignsById.values()].sort((first, second) => first.name.localeCompare(second.name))
}

/** The path params of a campaign's pages. */
export function campaignPathParams(campaign: MyReviewCampaignOutputDto) {
  return {
    organizationId: campaign.organizationId,
    projectId: campaign.projectId,
    reviewCampaignId: campaign.id,
  }
}
