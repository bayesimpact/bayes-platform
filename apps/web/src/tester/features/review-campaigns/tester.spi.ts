import type {
  MyReviewCampaign,
  MyTesterSessionSummary,
  StartTesterSessionResult,
  SubmitTesterFeedbackFields,
  SubmitTesterSurveyFields,
  TesterCampaignSurvey,
  TesterContext,
  TesterSessionFeedback,
  UpdateTesterFeedbackFields,
  UpdateTesterSurveyFields,
} from "./tester.models"

type ProjectScope = { organizationId: string; projectId: string }
type CampaignScope = ProjectScope & { reviewCampaignId: string }
type SessionScope = ProjectScope & { sessionId: string }

export interface ITesterSpi {
  listMyCampaigns(): Promise<MyReviewCampaign[]>
  getTesterContext(params: CampaignScope): Promise<TesterContext>
  listMyTesterSessions(params: CampaignScope): Promise<MyTesterSessionSummary[]>
  startSession(params: CampaignScope): Promise<StartTesterSessionResult>
  submitFeedback(
    params: SessionScope,
    payload: SubmitTesterFeedbackFields,
  ): Promise<TesterSessionFeedback>
  updateFeedback(
    params: SessionScope,
    payload: UpdateTesterFeedbackFields,
  ): Promise<TesterSessionFeedback>
  submitSurvey(
    params: CampaignScope,
    payload: SubmitTesterSurveyFields,
  ): Promise<TesterCampaignSurvey>
  updateSurvey(
    params: CampaignScope,
    payload: UpdateTesterSurveyFields,
  ): Promise<TesterCampaignSurvey>
  getMyTesterSurvey(params: CampaignScope): Promise<TesterCampaignSurvey | null>
  deleteSession(params: SessionScope): Promise<void>
}
