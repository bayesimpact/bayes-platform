import { createSlice } from "@reduxjs/toolkit"

interface State {
  organizationId: string | null
  projectId: string | null
  agentId: string | null
  agentSessionId: string | null
  membershipId: string | null
  reviewCampaignId: string | null
  csvRunId: string | null
}

const initialState: State = {
  organizationId: null,
  projectId: null,
  agentId: null,
  agentSessionId: null,
  membershipId: null,
  reviewCampaignId: null,
  csvRunId: null,
}

const slice = createSlice({
  name: "currentIds",
  initialState,
  reducers: {
    reset: () => initialState,
    setOrganizationId: setId("organizationId"),
    setProjectId: setId("projectId"),
    setAgentId: setId("agentId"),
    setAgentSessionId: setId("agentSessionId"),
    setMembershipId: setId("membershipId"),
    setReviewCampaignId: setId("reviewCampaignId"),
    setCsvRunId: setId("csvRunId"),
  },
})

function setId(id: keyof State) {
  return (state: State, { payload }: { payload: string | null }) => {
    state[id] = payload
  }
}

export const currentIdsActions = { ...slice.actions }
export const currentIdsSlice = slice
