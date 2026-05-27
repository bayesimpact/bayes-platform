import type { RootState } from "@/common/store"

export const selectCurrentReviewerSessionId = (state: RootState) =>
  state.currentIds.agentSessionId ?? null

export const hasReviewerSessionIdChanged = (originalState: RootState, currentState: RootState) => {
  if (!originalState.currentIds || !currentState.currentIds) return false
  const prevId = selectCurrentReviewerSessionId(originalState)
  const nextId = selectCurrentReviewerSessionId(currentState)
  return prevId !== nextId
}
