import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { ThunkConfig } from "@/common/store/types"
import type { EvaluationConversationDataset } from "./evaluation-conversation-datasets.models"

const listDatasets = createAsyncThunk<EvaluationConversationDataset[], void, ThunkConfig>(
  "conversationDatasets/listDatasets",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationConversationDatasets.getAll(params)
  },
)

export const evaluationConversationDatasetsThunks = { listDatasets }
