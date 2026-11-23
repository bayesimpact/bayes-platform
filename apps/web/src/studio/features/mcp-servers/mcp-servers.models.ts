import type {
  McpServerDto,
  McpServerInspectionDto,
  McpServerToolDto,
} from "@caseai-connect/api-contracts"

export type McpServer = McpServerDto

export type McpServerTool = McpServerToolDto

/** Result of one live connection to a server: does it answer, and with which tools. */
export type McpServerInspection = McpServerInspectionDto

/** What the studio knows about a server's connection, from the last inspection it asked for. */
export type McpServerConnection =
  /** Not asked yet. */
  | { state: "unknown" }
  /** First inspection in flight: nothing to show yet. */
  | { state: "checking" }
  | { state: "checked"; inspection: McpServerInspection; isRefreshing: boolean }
  /** The platform itself could not run the inspection. */
  | { state: "unavailable" }
