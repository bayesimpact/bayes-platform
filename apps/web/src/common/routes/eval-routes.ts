import { defineRoute } from "./helpers"

const project = defineRoute("/eval/o/:organizationId/p/:projectId")

/**
 * Pages of the Evaluation app (apps/eval), an app of its own served at `/eval`: a link to one
 * leaves this app with a full page load, never through its router.
 */
export const EvalRoutes = {
  project,
  // Project URLs of the former evaluation pages: the app opens them under an agent of the project.
  conversation: project.extend("/conversation"),
  extraction: project.extend("/extraction"),
}
