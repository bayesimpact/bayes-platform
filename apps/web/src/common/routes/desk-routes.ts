import { defineRoute } from "./helpers"

const project = defineRoute("/app/o/:organizationId/p/:projectId")

/**
 * Pages of the Desk (apps/desk), an app of its own that the server serves at `/app`: a link to one
 * leaves this app with a full page load, never through its router.
 */
export const DeskRoutes = {
  project,
  agent: project.extend("/a/:agentId"),
}
