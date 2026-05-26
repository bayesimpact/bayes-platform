import type { RootState } from "@/common/store"

export const selectCurrentAgentSessionId = (state: RootState) => {
  return state.currentIds.agentSessionId
}

export const hasAgentSessionChanged = (originalState: RootState, currentState: RootState) => {
  if (!originalState.currentIds) return false
  if (!currentState.currentIds) return false
  const prevId = selectCurrentAgentSessionId(originalState)
  const nextId = selectCurrentAgentSessionId(currentState)
  return prevId !== nextId && !!nextId
}
