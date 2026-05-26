import { createSelector } from "@reduxjs/toolkit"
import { selectCurrentAgentSessionId } from "@/common/features/agents/agent-sessions/current-agent-session-id/current-agent-session-id.selectors"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { LocalSessionSummary } from "./tester.slice"

export const selectMyReviewCampaigns = (state: RootState) => state.reviewCampaignsTester.myCampaigns

export const selectTesterContext = (state: RootState) => state.reviewCampaignsTester.testerContext

export const selectCurrentCampaignId = (state: RootState) => state.currentIds.reviewCampaignId

export const selectCampaignSessions = (state: RootState) =>
  state.reviewCampaignsTester.campaignSessions

export const selectCampaignSurvey = (state: RootState) => state.reviewCampaignsTester.campaignSurvey

export const selectCurrentAgentSession = createSelector(
  [selectCampaignSessions, selectCurrentAgentSessionId],
  (sessions, sessionId): AsyncData<LocalSessionSummary> => {
    if (!sessionId) return { status: ADS.Error, value: null, error: "No Session selected" }
    if (!ADS.isFulfilled(sessions)) return { ...sessions }
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session)
      return { status: ADS.Error, value: null, error: "Session not found in current project" }
    return { status: ADS.Fulfilled, value: session, error: null }
  },
)
