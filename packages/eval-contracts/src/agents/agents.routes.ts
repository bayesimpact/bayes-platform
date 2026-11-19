import { z } from "zod"
import {
  AGENT_PATH,
  agentParamsSchema,
  PROJECT_PATH,
  projectParamsSchema,
} from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import { agentVersionOutputSchema, projectAgentOutputSchema } from "./agents.dto"

export const EvalAgentsRoutes = {
  getAllOfProject: defineSchemaRoute({
    method: "get",
    path: `${PROJECT_PATH}/agents-with-drafts`,
    params: projectParamsSchema,
    response: z.array(projectAgentOutputSchema),
  }),
  /** The versions of an agent's settings, the draft included: `agent.settings.read`. */
  getVersions: defineSchemaRoute({
    method: "get",
    path: `${AGENT_PATH}/settings`,
    params: agentParamsSchema,
    response: z.array(agentVersionOutputSchema),
  }),
}
