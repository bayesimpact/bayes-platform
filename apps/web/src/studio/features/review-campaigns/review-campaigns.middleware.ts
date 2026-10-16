import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createInvitations,
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
      const { targetType, targetId } = action.meta.arg
      if (targetType !== "review_campaign") return
      await listenerApi.dispatch(listInvitationsForTarget({ targetType, targetId }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitations.fulfilled,
    effect: async (action, listenerApi) => {
      const { targetType, targetId } = action.meta.arg
      if (targetType !== "review_campaign") return
      await listenerApi.dispatch(listInvitationsForTarget({ targetType, targetId }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitations.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "review_campaign") return
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: action.payload.emailSent
            ? "reviewCampaigns:notifications.invitationsSentByEmail"
            : "reviewCampaigns:notifications.peopleInvited",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitations.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "review_campaign") return
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "reviewCampaigns:notifications.inviteError",
          type: "error",
        }),
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
      success: "reviewCampaigns:notifications.createSuccess",
      error: "reviewCampaigns:notifications.createError",
    },
    {
      action: updateReviewCampaign,
      success: "reviewCampaigns:notifications.updateSuccess",
      error: "reviewCampaigns:notifications.updateError",
    },
    {
      action: deleteReviewCampaign,
      success: "reviewCampaigns:notifications.deleteSuccess",
      error: "reviewCampaigns:notifications.deleteError",
    },
    {
      action: revokeReviewCampaignMembership,
      success: "reviewCampaigns:notifications.revokeSuccess",
      error: "reviewCampaigns:notifications.revokeError",
    },
  ]

  for (const { action, success, error } of notifications) {
    listenerMiddleware.startListening({
      actionCreator: action.fulfilled,
      effect: async (_, listenerApi) => {
        listenerApi.dispatch(notificationsActions.show({ titleKey: success, type: "success" }))
      },
    })
    listenerMiddleware.startListening({
      actionCreator: action.rejected,
      effect: async (_, listenerApi) => {
        listenerApi.dispatch(notificationsActions.show({ titleKey: error, type: "error" }))
      },
    })
  }
}

export const reviewCampaignsMiddleware = { listenerMiddleware, registerListeners }
