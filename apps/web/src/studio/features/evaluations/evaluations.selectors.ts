import type { RootState } from "@/common/store"

export const selectEvaluationsStatus = (state: RootState) => state.evaluations.data.status

export const selectEvaluationsError = (state: RootState) => state.evaluations.data.error

export const selectEvaluationsData = (state: RootState) => state.evaluations.data
