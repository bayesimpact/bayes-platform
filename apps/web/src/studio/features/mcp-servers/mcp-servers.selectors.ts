import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import type { McpServerConnection } from "./mcp-servers.models"

export const selectMcpServersData = (state: RootState) => state.mcpServers.data

const selectInspections = (state: RootState) => state.mcpServers.inspections
const selectInspectingIds = (state: RootState) => state.mcpServers.inspectingIds

/**
 * The connection of every server that was inspected or is being inspected, by
 * server id. A server with no entry was never asked: read it with
 * `connectionOf`.
 */
export const selectMcpServerConnections = createSelector(
  [selectInspections, selectInspectingIds],
  (inspections, inspectingIds): Record<string, McpServerConnection> => {
    const connections: Record<string, McpServerConnection> = {}
    for (const mcpServerId of inspectingIds) {
      connections[mcpServerId] = { state: "checking" }
    }
    for (const [mcpServerId, inspection] of Object.entries(inspections)) {
      const isRefreshing = inspectingIds.includes(mcpServerId)
      if (ADS.isFulfilled(inspection)) {
        connections[mcpServerId] = { state: "checked", inspection: inspection.value, isRefreshing }
      } else if (!isRefreshing) {
        connections[mcpServerId] = { state: "unavailable" }
      }
    }
    return connections
  },
)

const UNKNOWN_CONNECTION: McpServerConnection = { state: "unknown" }

export function connectionOf(
  connections: Record<string, McpServerConnection>,
  mcpServerId: string,
): McpServerConnection {
  return connections[mcpServerId] ?? UNKNOWN_CONNECTION
}
