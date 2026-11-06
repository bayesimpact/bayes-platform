import { z } from "zod"
import { AGENT_PATH, agentParamsSchema } from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import {
  memoryOutputSchema,
  memoryParamsSchema,
  resolveMemoryProposalsInputSchema,
} from "./memories.dto"

const memoriesPath = `${AGENT_PATH}/memories/live`

/**
 * The facts an agent remembers about the signed-in person. The routes check `agent.read`: a
 * person with no role on the agent gets a 403, and the Desk then shows no memory.
 */
export const DeskMemoriesRoutes = {
  getAll: defineSchemaRoute({
    method: "get",
    path: memoriesPath,
    params: agentParamsSchema,
    response: z.array(memoryOutputSchema),
  }),
  deleteOne: defineSchemaRoute({
    method: "delete",
    path: `${memoriesPath}/:memoryId`,
    params: memoryParamsSchema,
    response: z.object({ success: z.boolean() }),
  }),
  deleteAll: defineSchemaRoute({
    method: "delete",
    path: memoriesPath,
    params: agentParamsSchema,
    response: z.object({ success: z.boolean() }),
  }),
  /** Saves, rewords or rejects facts the agent proposed; answers with the facts saved. */
  resolveProposals: defineSchemaRoute({
    method: "post",
    path: `${memoriesPath}/resolve-proposals`,
    params: agentParamsSchema,
    body: resolveMemoryProposalsInputSchema,
    response: z.array(memoryOutputSchema),
  }),
}
