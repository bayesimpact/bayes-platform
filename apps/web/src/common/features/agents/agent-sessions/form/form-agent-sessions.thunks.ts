import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { buildType } from "../shared/base-agent-session/base-agent-sessions.thunks"
import type { FormAgentSession } from "./form-agent-sessions.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const refreshFormResultForCurrentAgentSession = createAsyncThunk<
  FormAgentSession[],
  { agentId: string },
  ThunkConfig
>(
  "formAgentSession/refreshFormResultForCurrentAgentSession",
  async ({ agentId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    // NOTE: this is a proxy of listFormAgentSessions because middleware listener causes a bug on messages.
    // TODO: need a dedicated endpoint
    return services.formAgentSessions.getAll({
      ...params,
      agentId,
      type: buildType(),
    })
  },
)
