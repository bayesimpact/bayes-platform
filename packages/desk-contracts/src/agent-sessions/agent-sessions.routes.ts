import { z } from "zod"
import { AGENT_PATH, agentParamsSchema } from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import { csvExtractionRunDetailOutputSchema } from "../extractions/extractions.dto"
import { conversationSessionOutputSchema, extractionRunOutputSchema } from "./agent-sessions.dto"

/** The history of the signed-in person with one agent: only their own live sessions. */
export const DeskAgentSessionsRoutes = {
  getConversations: defineSchemaRoute({
    method: "post",
    path: `${AGENT_PATH}/conversation-agent-sessions/live`,
    params: agentParamsSchema,
    response: z.array(conversationSessionOutputSchema),
  }),
  getExtractionRuns: defineSchemaRoute({
    method: "post",
    path: `${AGENT_PATH}/extraction-agent-sessions/live`,
    params: agentParamsSchema,
    response: z.array(extractionRunOutputSchema),
  }),
  getCsvExtractionRuns: defineSchemaRoute({
    method: "get",
    path: `${AGENT_PATH}/csv-extraction-runs/live`,
    params: agentParamsSchema,
    response: z.array(csvExtractionRunDetailOutputSchema),
  }),
}
