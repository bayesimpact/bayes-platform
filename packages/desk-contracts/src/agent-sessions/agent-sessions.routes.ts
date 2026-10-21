import { z } from "zod"
import { defineSchemaRoute } from "../define-schema-route"
import { csvExtractionRunDetailOutputSchema } from "../extractions/extractions.dto"
import {
  agentParamsSchema,
  conversationSessionOutputSchema,
  extractionRunOutputSchema,
} from "./agent-sessions.dto"

const agentPath = "organizations/:organizationId/projects/:projectId/agents/:agentId"

/** The history of the signed-in person with one agent: only their own live sessions. */
export const DeskAgentSessionsRoutes = {
  getConversations: defineSchemaRoute({
    method: "post",
    path: `${agentPath}/conversation-agent-sessions/live`,
    params: agentParamsSchema,
    response: z.array(conversationSessionOutputSchema),
  }),
  getExtractionRuns: defineSchemaRoute({
    method: "post",
    path: `${agentPath}/extraction-agent-sessions/live`,
    params: agentParamsSchema,
    response: z.array(extractionRunOutputSchema),
  }),
  getCsvExtractionRuns: defineSchemaRoute({
    method: "get",
    path: `${agentPath}/csv-extraction-runs/live`,
    params: agentParamsSchema,
    response: z.array(csvExtractionRunDetailOutputSchema),
  }),
}
