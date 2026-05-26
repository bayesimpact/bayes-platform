import { createSlice } from "@reduxjs/toolkit"

interface State {
  organizationId: string | null
  projectId: string | null
  datasetId: string | null
  runId: string | null
  fileId: string | null
}

const initialState: State = {
  organizationId: null,
  projectId: null,
  datasetId: null,
  runId: null,
  fileId: null,
}

const slice = createSlice({
  name: "currentIds",
  initialState,
  reducers: {
    reset: () => initialState,
    setOrganizationId: setId("organizationId"),
    setProjectId: setId("projectId"),
    setDatasetId: setId("datasetId"),
    setRunId: setId("runId"),
    setFileId: setId("fileId"),
  },
})

function setId(id: keyof State) {
  return (state: State, { payload }: { payload: string | null }) => {
    state[id] = payload
  }
}

export const currentIdsActions = { ...slice.actions }
export const currentIdsSlice = slice
