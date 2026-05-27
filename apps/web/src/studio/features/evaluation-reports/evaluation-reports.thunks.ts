import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { EvaluationReport } from "./evaluation-reports.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listEvaluationReports = createAsyncThunk<
  EvaluationReport[],
  { evaluationId: string },
  ThunkConfig
>("evaluationReports/list", async (params, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.evaluationReports.getAll({ ...params, organizationId, projectId })
})

export const createEvaluationReport = createAsyncThunk<
  EvaluationReport,
  { agentId: string; evaluationId: string },
  ThunkConfig
>(
  "evaluationReports/create",
  async ({ agentId, evaluationId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.evaluationReports.createOne({
      organizationId,
      projectId,
      agentId,
      evaluationId,
    })
  },
)
