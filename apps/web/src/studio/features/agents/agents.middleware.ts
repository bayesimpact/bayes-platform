import { createListenerMiddleware, isAnyOf, type UnknownAction } from "@reduxjs/toolkit"
import { listAgents } from "@/common/features/agents/agents.thunks"
import { updateAgentSettings } from "@/common/features/agents/settings/agent-settings.thunks"
import { fetchMe } from "@/common/features/me/me.thunks"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import i18n from "@/i18n"
import {
  createAgent,
  deleteAgent,
  renameAgent,
  saveAgentGeneral,
  saveAgentSources,
  updateAgentDocumentTags,
  updateAgentResourceLibraries,
  updateAgentSessionCategories,
} from "@/studio/features/agents/agents.thunks"
import {
  deleteDocumentTag,
  updateDocumentTag,
} from "@/studio/features/document-tags/document-tags.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

/**
 * True when the thunk that dispatched this action was told `silent: true`. Composite thunks
 * (saveAgentGeneral, saveAgentSources) set this on the sub-thunks they dispatch internally, so
 * their own fulfilled/rejected is the only one that produces a user-facing notification and
 * refetch.
 */
function isSilent(action: UnknownAction): boolean {
  const meta = action.meta
  if (typeof meta !== "object" || meta === null || !("arg" in meta)) return false
  const arg = meta.arg
  if (typeof arg !== "object" || arg === null || !("silent" in arg)) return false
  return arg.silent === true
}

/**
 * True when the save this action represents left the agent's settings in an unpublished draft
 * revision, rather than live. `updateAgentSettings` always does that (the API never republishes
 * in place). The two composite thunks (`saveAgentGeneral`, `saveAgentSources`) only sometimes
 * touch settings: a General-tab save of just the name, or a Sources-tab save of just the
 * document tag set, never calls `updateAgentSettings` at all. So their own `fulfilled` is
 * checked against which fields were actually submitted, mirroring the check each thunk itself
 * makes before dispatching `updateAgentSettings`. Every other action here (rename, tags,
 * resource libraries, session categories) is agent-level only and is live immediately.
 */
function producedSettingsDraft(action: UnknownAction): boolean {
  if (updateAgentSettings.fulfilled.match(action)) return true
  if (saveAgentGeneral.fulfilled.match(action)) {
    const { name: _name, ...settingsFields } = action.meta.arg.fields
    return Object.keys(settingsFields).length > 0
  }
  if (saveAgentSources.fulfilled.match(action)) {
    return action.meta.arg.documentsRagMode !== undefined
  }
  return false
}

function registerListeners() {
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      // DocumentTag changes
      updateDocumentTag.fulfilled,
      deleteDocumentTag.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listAgents())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteAgent.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent deleted successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent deletion failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createAgent.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent created successfully",
          type: "success",
        }),
      )

      const onSuccess = action.meta.arg.onSuccess
      onSuccess?.(action.payload)

      listenerApi.dispatch(fetchMe()) // To update agent membership and then abilities
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent creation failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      saveAgentGeneral.fulfilled,
      saveAgentSources.fulfilled,
      renameAgent.fulfilled,
      updateAgentDocumentTags.fulfilled,
      updateAgentResourceLibraries.fulfilled,
      updateAgentSessionCategories.fulfilled,
      updateAgentSettings.fulfilled,
    ),
    effect: async (action, listenerApi) => {
      // A composite thunk's sub-dispatches are silent: the composite's own fulfilled/rejected
      // (matched separately here, since it isn't silent) owns the single notification + refetch.
      if (isSilent(action)) return

      listenerApi.dispatch(listAgents())

      listenerApi.dispatch(
        notificationsActions.show({
          title: producedSettingsDraft(action)
            ? i18n.t("agent:draftSaveNotification")
            : "Agent updated successfully",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      saveAgentGeneral.rejected,
      saveAgentSources.rejected,
      renameAgent.rejected,
      updateAgentDocumentTags.rejected,
      updateAgentResourceLibraries.rejected,
      updateAgentSessionCategories.rejected,
      updateAgentSettings.rejected,
    ),
    effect: async (action, listenerApi) => {
      if (isSilent(action)) return

      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent update failed",
          type: "error",
        }),
      )
    },
  })
}
export const studioAgentsMiddleware = { listenerMiddleware, registerListeners }
