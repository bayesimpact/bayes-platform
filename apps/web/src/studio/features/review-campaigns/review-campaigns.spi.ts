import type {
  CreateReviewCampaignRequestDto,
  UpdateReviewCampaignRequestDto,
} from "@caseai-connect/api-contracts"
import type {
  ReviewCampaign,
  ReviewCampaignDetail,
  ReviewCampaignListItem,
} from "./review-campaigns.models"

type ProjectScope = { organizationId: string; projectId: string }
type CampaignScope = ProjectScope & { reviewCampaignId: string }

export interface IReviewCampaignsSpi {
  getAll(params: ProjectScope): Promise<ReviewCampaignListItem[]>

  getOne(params: CampaignScope): Promise<ReviewCampaignDetail>

  createOne(params: ProjectScope, payload: CreateReviewCampaignRequestDto): Promise<ReviewCampaign>

  updateOne(params: CampaignScope, payload: UpdateReviewCampaignRequestDto): Promise<ReviewCampaign>

  deleteOne(params: CampaignScope): Promise<void>

  revokeMembership(params: CampaignScope & { membershipId: string }): Promise<void>
}
