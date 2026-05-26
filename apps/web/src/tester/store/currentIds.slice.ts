import { createSlice } from "@reduxjs/toolkit"

interface State {
  organizationId: string | null
  projectId: string | null
  reviewCampaignId: string | null
  agentId: string | null
  agentSessionId: string | null
}

const initialState: State = {
  organizationId: null,
  projectId: null,
  reviewCampaignId: null,
  agentId: null,
  agentSessionId: null,
}

const slice = createSlice({
  name: "currentIds",
  initialState,
  reducers: {
    reset: () => initialState,
    setOrganizationId: setId("organizationId"),
    setProjectId: setId("projectId"),
    setReviewCampaignId: setId("reviewCampaignId"),
    setAgentId: setId("agentId"),
    setAgentSessionId: setId("agentSessionId"),
  },
})

function setId(id: keyof State) {
  return (state: State, { payload }: { payload: string | null }) => {
    state[id] = payload
  }
}

export const currentIdsActions = { ...slice.actions }
export const currentIdsSlice = slice
