import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { McpServer, McpServerInspection } from "./mcp-servers.models"
import { inspectMcpServer, listMcpServers, updateMcpServer } from "./mcp-servers.thunks"

interface State {
  data: AsyncData<McpServer[]>
  /** Last inspection asked for each server, by server id. Never loaded with the list. */
  inspections: Record<string, AsyncData<McpServerInspection>>
  /**
   * The inspection in flight for each server, by server id: the id of the
   * request that counts. A second inspection of a server replaces the first,
   * whose late answer is then ignored: it describes a configuration that may
   * have been edited since. A refresh keeps the previous result on screen.
   */
  inspectionRequestIds: Record<string, string>
}

const initialState: State = {
  data: defaultAsyncData,
  inspections: {},
  inspectionRequestIds: {},
}

const slice = createSlice({
  name: "mcpServers",
  initialState,
  reducers: {
    /** The MCP servers page opened: see the middleware. */
    mount: () => {},
    unmount: () => {},
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
        const listedIds = new Set(action.payload.map((mcpServer) => mcpServer.id))
        for (const mcpServerId of Object.keys(state.inspections)) {
          if (!listedIds.has(mcpServerId)) delete state.inspections[mcpServerId]
        }
        for (const mcpServerId of Object.keys(state.inspectionRequestIds)) {
          if (!listedIds.has(mcpServerId)) delete state.inspectionRequestIds[mcpServerId]
        }
      })
      .addCase(listMcpServers.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list MCP servers"
      })
      // What was true of the previous URL or key says nothing about the new one.
      .addCase(updateMcpServer.fulfilled, (state, action) => {
        delete state.inspections[action.payload.id]
      })
      .addCase(inspectMcpServer.pending, (state, action) => {
        state.inspectionRequestIds[action.meta.arg.mcpServerId] = action.meta.requestId
      })
      .addCase(inspectMcpServer.fulfilled, (state, action) => {
        const { mcpServerId } = action.meta.arg
        if (state.inspectionRequestIds[mcpServerId] !== action.meta.requestId) return
        state.inspections[mcpServerId] = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
        delete state.inspectionRequestIds[mcpServerId]
      })
      .addCase(inspectMcpServer.rejected, (state, action) => {
        const { mcpServerId } = action.meta.arg
        if (state.inspectionRequestIds[mcpServerId] !== action.meta.requestId) return
        state.inspections[mcpServerId] = {
          status: ADS.Error,
          error: action.payload || "Failed to inspect the MCP server",
          value: null,
        }
        delete state.inspectionRequestIds[mcpServerId]
      })
  },
})

export const mcpServersActions = { ...slice.actions }
export const mcpServersSlice = slice
