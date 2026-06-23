import { createSlice } from "@reduxjs/toolkit"

interface State {
  organizationId: string | null
  projectId: string | null
  agentId: string | null
  agentSessionId: string | null
  csvRunId: string | null
  extractionRunId: string | null
}

const initialState: State = {
  organizationId: null,
  projectId: null,
  agentId: null,
  agentSessionId: null,
  csvRunId: null,
  extractionRunId: null,
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
    setCsvRunId: setId("csvRunId"),
    setExtractionRunId: setId("extractionRunId"),
  },
})

function setId(id: keyof State) {
  return (state: State, { payload }: { payload: string | null }) => {
    state[id] = payload
  }
}

export const currentIdsActions = { ...slice.actions }
export const currentIdsSlice = slice
