import type {
  ListMyReviewCampaignsResponseDto,
  MyTesterSessionSummaryDto,
  ReviewCampaignTesterContextDto,
  StartTesterSessionResponseDto,
  SubmitTesterCampaignSurveyRequestDto,
  SubmitTesterSessionFeedbackRequestDto,
  TesterCampaignSurveyDto,
  TesterSessionFeedbackDto,
  UpdateTesterCampaignSurveyRequestDto,
  UpdateTesterSessionFeedbackRequestDto,
} from "@caseai-connect/api-contracts"

export type MyReviewCampaign = ListMyReviewCampaignsResponseDto["reviewCampaigns"][number]
export type TesterContext = ReviewCampaignTesterContextDto
export type TesterSessionFeedback = TesterSessionFeedbackDto
export type TesterCampaignSurvey = TesterCampaignSurveyDto
export type StartTesterSessionResult = StartTesterSessionResponseDto
export type MyTesterSessionSummary = MyTesterSessionSummaryDto

export type {
  SubmitTesterCampaignSurveyRequestDto as SubmitTesterSurveyFields,
  SubmitTesterSessionFeedbackRequestDto as SubmitTesterFeedbackFields,
  UpdateTesterCampaignSurveyRequestDto as UpdateTesterSurveyFields,
  UpdateTesterSessionFeedbackRequestDto as UpdateTesterFeedbackFields,
}
