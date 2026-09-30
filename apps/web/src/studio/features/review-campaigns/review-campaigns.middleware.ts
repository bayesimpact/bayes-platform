import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { createMemberGrants } from "@/studio/features/member-grants/member-grants.thunks"
import { reviewCampaignsActions } from "./review-campaigns.slice"
import {
  createReviewCampaign,
  deleteReviewCampaign,
  getReviewCampaignDetail,
  listReviewCampaigns,
  revokeReviewCampaignMembership,
  updateReviewCampaign,
} from "./review-campaigns.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // Refresh list when project or organization changes
  listenerMiddleware.startListening({
    actionCreator: reviewCampaignsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listReviewCampaigns())
    },
  })

  // Load campaign detail when the editor sheet opens in edit mode.
  // CampaignEditorSheet dispatches `selectDetail({ reviewCampaignId })`;
  // see `apps/web/CLAUDE.md` → "Data Loading: Marker Action + Middleware".
  listenerMiddleware.startListening({
    actionCreator: reviewCampaignsActions.selectDetail,
    effect: async (action, listenerApi) => {
      await listenerApi.dispatch(
        getReviewCampaignDetail({ reviewCampaignId: action.payload.reviewCampaignId }),
      )
    },
  })

  // Refresh list after mutating actions
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      createReviewCampaign.fulfilled,
      updateReviewCampaign.fulfilled,
      deleteReviewCampaign.fulfilled,
      revokeReviewCampaignMembership.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listReviewCampaigns())
    },
  })

  // Participants added by email show up in the campaign detail right away
  listenerMiddleware.startListening({
    actionCreator: createMemberGrants.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "review_campaign") return
      listenerApi.dispatch(
        notificationsActions.show({ title: "Participants added", type: "success" }),
      )
      await listenerApi.dispatch(
        getReviewCampaignDetail({ reviewCampaignId: action.meta.arg.targetId }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createMemberGrants.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "review_campaign") return
      listenerApi.dispatch(
        notificationsActions.show({ title: "Failed to add participants", type: "error" }),
      )
    },
  })

  // Notifications — success / error for each action
  const notifications: Array<{
    action:
      | typeof createReviewCampaign
      | typeof updateReviewCampaign
      | typeof deleteReviewCampaign
      | typeof revokeReviewCampaignMembership
    success: string
    error: string
  }> = [
    {
      action: createReviewCampaign,
      success: "Review campaign created successfully",
      error: "Review campaign creation failed",
    },
    {
      action: updateReviewCampaign,
      success: "Review campaign updated successfully",
      error: "Review campaign update failed",
    },
    {
      action: deleteReviewCampaign,
      success: "Review campaign deleted successfully",
      error: "Review campaign deletion failed",
    },
    {
      action: revokeReviewCampaignMembership,
      success: "Membership revoked",
      error: "Failed to revoke membership",
    },
  ]

  for (const { action, success, error } of notifications) {
    listenerMiddleware.startListening({
      actionCreator: action.fulfilled,
      effect: async (_, listenerApi) => {
        listenerApi.dispatch(notificationsActions.show({ title: success, type: "success" }))
      },
    })
    listenerMiddleware.startListening({
      actionCreator: action.rejected,
      effect: async (_, listenerApi) => {
        listenerApi.dispatch(notificationsActions.show({ title: error, type: "error" }))
      },
    })
  }
}

export const reviewCampaignsMiddleware = { listenerMiddleware, registerListeners }
