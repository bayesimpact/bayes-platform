import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { hasOrganizationChanged } from "@/common/features/organizations/organizations.selectors"
import { hasProjectChanged } from "@/common/features/projects/projects.selectors"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createInvitationsForTarget,
  listInvitationsForTarget,
  revokeInvitation,
} from "@/studio/features/invitations/invitations.thunks"
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
    predicate(_, currentState, originalState) {
      return (
        hasProjectChanged(originalState, currentState) ||
        hasOrganizationChanged(originalState, currentState)
      )
    },
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
      await Promise.all([
        listenerApi.dispatch(
          getReviewCampaignDetail({ reviewCampaignId: action.payload.reviewCampaignId }),
        ),
        listenerApi.dispatch(
          listInvitationsForTarget({
            targetType: "review_campaign",
            targetId: action.payload.reviewCampaignId,
          }),
        ),
      ])
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

  listenerMiddleware.startListening({
    actionCreator: revokeInvitation.fulfilled,
    effect: async (action, listenerApi) => {
      const refreshTarget = action.meta.arg.refreshTarget
      if (refreshTarget?.targetType !== "review_campaign") return
      await listenerApi.dispatch(listInvitationsForTarget(refreshTarget))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitationsForTarget.fulfilled,
    effect: async (action, listenerApi) => {
      const refreshTarget = action.meta.arg.refreshTarget
      if (refreshTarget?.targetType !== "review_campaign") return
      await listenerApi.dispatch(listInvitationsForTarget(refreshTarget))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitationsForTarget.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.refreshTarget?.targetType !== "review_campaign") return
      listenerApi.dispatch(
        notificationsActions.show({ title: "Invitations sent", type: "success" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitationsForTarget.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.refreshTarget?.targetType !== "review_campaign") return
      listenerApi.dispatch(
        notificationsActions.show({ title: "Failed to send invitations", type: "error" }),
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
