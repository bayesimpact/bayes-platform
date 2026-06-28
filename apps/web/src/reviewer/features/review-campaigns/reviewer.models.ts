import type {
  GetReviewerSessionResponseDto,
  ListMyReviewCampaignsResponseDto,
  ReviewCampaignTesterContextDto,
  ReviewerSessionListItemDto,
  ReviewerSessionReviewDto,
  SubmitReviewerSessionReviewRequestDto,
  UpdateReviewerSessionReviewRequestDto,
} from "@caseai-connect/api-contracts"

export type ReviewerCampaign = ListMyReviewCampaignsResponseDto["reviewCampaigns"][number]
export type ReviewerSessionListItem = ReviewerSessionListItemDto
export type ReviewerSessionDetail = GetReviewerSessionResponseDto
export type ReviewerSessionReview = ReviewerSessionReviewDto
export type ReviewCampaignTesterContext = ReviewCampaignTesterContextDto

export type {
  SubmitReviewerSessionReviewRequestDto as SubmitReviewerReviewFields,
  UpdateReviewerSessionReviewRequestDto as UpdateReviewerReviewFields,
}
