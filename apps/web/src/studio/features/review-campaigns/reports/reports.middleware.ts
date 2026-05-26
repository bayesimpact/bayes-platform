import { createListenerMiddleware } from "@reduxjs/toolkit"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import type { AppDispatch, RootState } from "@/common/store/types"
import { reviewCampaignsReportsActions } from "./reports.slice"
import { getCampaignReport } from "./reports.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: reviewCampaignsReportsActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const organizationId = selectCurrentOrganizationId(state)
      const projectId = selectCurrentProjectId(state)
      const reviewCampaignId = selectCurrentReviewCampaignId(state)
      if (!organizationId || !projectId || !reviewCampaignId) return
      listenerApi.dispatch(getCampaignReport({ organizationId, projectId, reviewCampaignId }))
    },
  })
}

export const reviewCampaignsReportsMiddleware = {
  registerListeners,
  listenerMiddleware,
}
