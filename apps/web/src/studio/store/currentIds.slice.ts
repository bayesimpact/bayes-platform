import { createSlice } from "@reduxjs/toolkit"

interface State {
  organizationId: string | null
  projectId: string | null
  agentId: string | null
  agentSessionId: string | null
  memberUserId: string | null
  csvRunId: string | null
  extractionRunId: string | null
  resourceLibraryId: string | null
  resourceId: string | null
}

const initialState: State = {
  organizationId: null,
  projectId: null,
  agentId: null,
  agentSessionId: null,
  memberUserId: null,
  csvRunId: null,
  extractionRunId: null,
  resourceLibraryId: null,
  resourceId: null,
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
    setMemberUserId: setId("memberUserId"),
    setCsvRunId: setId("csvRunId"),
    setExtractionRunId: setId("extractionRunId"),
    setResourceLibraryId: setId("resourceLibraryId"),
    setResourceId: setId("resourceId"),
  },
})

function setId(id: keyof State) {
  return (state: State, { payload }: { payload: string | null }) => {
    state[id] = payload
  }
}

export const currentIdsActions = { ...slice.actions }
export const currentIdsSlice = slice
