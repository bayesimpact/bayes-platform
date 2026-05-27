import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { EvaluationReport } from "./evaluation-reports.models"

export const selectEvaluationReportsStatus = (state: RootState) =>
  state.evaluationReports.data.status

export const selectEvaluationReportsError = (state: RootState) => state.evaluationReports.data.error

export const selectEvaluationReportsData = (state: RootState) => state.evaluationReports.data

const missingEvaluationId = {
  status: ADS.Error,
  value: null,
  error: "No evaluation selected",
}
const missingReports = {
  status: ADS.Error,
  value: null,
  error: "No evaluation reports available",
}

export const selectEvaluationReportsForEvaluation = (evaluationId: string | null) =>
  createSelector([selectEvaluationReportsData], (reportsData): AsyncData<EvaluationReport[]> => {
    if (!evaluationId) return missingEvaluationId

    if (!ADS.isFulfilled(reportsData)) return { ...reportsData }

    if (!reportsData.value?.[evaluationId]) return missingReports

    return { status: ADS.Fulfilled, value: reportsData.value[evaluationId], error: null }
  })
