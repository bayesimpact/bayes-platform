import { defineSchemaRoute } from "@bayes-platform/schema-route"
import { z } from "zod"
import {
  AGENT_PATH,
  agentParamsSchema,
  PROJECT_PATH,
  projectParamsSchema,
} from "../common/params.dto"
import { agentModelsOutputSchema } from "./agent-versions.dto"
import { agentVersionOutputSchema, projectAgentOutputSchema } from "./agents.dto"

export const EvalAgentsRoutes = {
  /**
   * The agents of a project that have a version in production. An evaluation and a review
   * campaign run a saved version, never a draft, so the route that also lists the agents never
   * saved, with their drafts, is not the app's.
   */
  getAllOfProject: defineSchemaRoute({
    method: "get",
    path: `${PROJECT_PATH}/agents`,
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
  /** The models of a project, available or not, and its default judge. */
  getModels: defineSchemaRoute({
    method: "get",
    path: `${PROJECT_PATH}/agent-models`,
    params: projectParamsSchema,
    response: agentModelsOutputSchema,
  }),
}
