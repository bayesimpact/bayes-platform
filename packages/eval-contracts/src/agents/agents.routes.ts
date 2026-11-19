import { z } from "zod"
import {
  AGENT_PATH,
  agentParamsSchema,
  PROJECT_PATH,
  projectParamsSchema,
} from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import { agentModelsOutputSchema, agentVersionOutputSchema } from "./agent-versions.dto"
import { projectAgentOutputSchema } from "./agents.dto"

export const EvalAgentsRoutes = {
  getAllOfProject: defineSchemaRoute({
    method: "get",
    path: `${PROJECT_PATH}/agents-with-drafts`,
    params: projectParamsSchema,
    response: z.array(projectAgentOutputSchema),
  }),
  /** The versions of an agent's settings, its draft included. */
  getVersions: defineSchemaRoute({
    method: "get",
    path: `${AGENT_PATH}/settings`,
    params: agentParamsSchema,
    response: z.array(agentVersionOutputSchema),
  }),
  /** The models of a project, available or not, and its default judge. */
  getModels: defineSchemaRoute({
    method: "get",
    path: `${PROJECT_PATH}/agent-models`,
    params: projectParamsSchema,
    response: agentModelsOutputSchema,
  }),
}
