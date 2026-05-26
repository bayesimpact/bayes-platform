import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
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

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

type CampaignScopeArg = { organizationId: string; projectId: string; reviewCampaignId: string }
type SessionScopeArg = { organizationId: string; projectId: string; sessionId: string }

export const listMyReviewCampaigns = createAsyncThunk<MyReviewCampaign[], void, ThunkConfig>(
  "tester/listMyCampaigns",
  async (_, { extra: { services } }) => {
    return await services.reviewCampaignsTester.listMyCampaigns()
  },
)

export const getTesterContext = createAsyncThunk<TesterContext, CampaignScopeArg, ThunkConfig>(
  "tester/getContext",
  async (params, { extra: { services } }) => {
    return await services.reviewCampaignsTester.getTesterContext(params)
  },
)

export const startTesterSession = createAsyncThunk<
  StartTesterSessionResult,
  { onSuccess?: (sessionId: string) => void },
  ThunkConfig
>("tester/startSession", async (_, { getState, extra: { services }, dispatch }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })

  const params = { organizationId, projectId, reviewCampaignId }
  const type = "live"
  const result = await services.reviewCampaignsTester.startSession(params, { type })

  // Refresh sessions after starting a new one
  dispatch(listMyTesterSessions(params))
  return result
})

export const listMyTesterSessions = createAsyncThunk<
  MyTesterSessionSummary[],
  CampaignScopeArg,
  ThunkConfig
>("tester/listMyTesterSessions", async (params, { extra: { services } }) => {
  return await services.reviewCampaignsTester.listMyTesterSessions(params)
})

export const submitTesterFeedback = createAsyncThunk<
  TesterSessionFeedback,
  { fields: SubmitTesterFeedbackFields; sessionId: string },
  ThunkConfig
>(
  "tester/submitFeedback",
  async ({ fields, sessionId }, { getState, dispatch, extra: { services } }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })

    const params = { organizationId, projectId, sessionId }
    const feedback = await services.reviewCampaignsTester.submitFeedback(params, fields)

    await dispatch(listMyTesterSessions({ organizationId, projectId, reviewCampaignId }))
    return feedback
  },
)

// FIXME: is it used somewhere?
export const updateTesterFeedback = createAsyncThunk<
  TesterSessionFeedback,
  SessionScopeArg & { fields: UpdateTesterFeedbackFields },
  ThunkConfig
>("tester/updateFeedback", async ({ fields, ...params }, { extra: { services } }) => {
  return await services.reviewCampaignsTester.updateFeedback(params, fields)
})

export const submitTesterSurvey = createAsyncThunk<
  TesterCampaignSurvey,
  { fields: SubmitTesterSurveyFields },
  ThunkConfig
>("tester/submitSurvey", async ({ fields }, { getState, dispatch, extra: { services } }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })

  const params = { organizationId, projectId, reviewCampaignId }
  const data = await services.reviewCampaignsTester.submitSurvey(params, fields)

  await dispatch(getMyTesterSurvey())
  return data
})

export const updateTesterSurvey = createAsyncThunk<
  TesterCampaignSurvey,
  { fields: UpdateTesterSurveyFields },
  ThunkConfig
>("tester/updateSurvey", async ({ fields }, { getState, extra: { services } }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })

  const params = { organizationId, projectId, reviewCampaignId }
  return await services.reviewCampaignsTester.updateSurvey(params, fields)
})

export const getMyTesterSurvey = createAsyncThunk<TesterCampaignSurvey | null, void, ThunkConfig>(
  "tester/getMyTesterSurvey",
  async (_, { getState, extra: { services } }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })
    const scope = { organizationId, projectId, reviewCampaignId }
    return await services.reviewCampaignsTester.getMyTesterSurvey(scope)
  },
)

export const deleteTesterSession = createAsyncThunk<void, { sessionId: string }, ThunkConfig>(
  "tester/deleteSession",
  async ({ sessionId }, { extra: { services }, dispatch, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const reviewCampaignId = getCurrentId({ state, name: "reviewCampaignId" })

    const scope = { organizationId, projectId, reviewCampaignId, sessionId }
    await services.reviewCampaignsTester.deleteSession(scope)
    await dispatch(listMyTesterSessions(scope))
  },
)
