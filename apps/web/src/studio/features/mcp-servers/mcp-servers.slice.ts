import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { McpServer } from "./mcp-servers.models"
import { listMcpServers } from "./mcp-servers.thunks"

interface State {
  data: AsyncData<McpServer[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "mcpServers",
  initialState,
  reducers: {
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listMcpServers.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listMcpServers.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listMcpServers.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list MCP servers"
      })
  },
})

export const mcpServersActions = { ...slice.actions }
export const mcpServersSlice = slice
