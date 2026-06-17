import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/backoffice")

export const BackofficeRoutes = { home }

export const BackofficeUserRoutes = {
  users: home.extend("/users"),
  user: home.extend("/users/:userId"),
}

export const BackofficeOrganizationRoutes = {
  organizations: home.extend("/organizations"),
  organization: home.extend("/organizations/:organizationId"),
}

export const BackofficeAgentRoutes = {
  agents: home.extend("/agents"),
  agent: home.extend("/agents/:agentId"),
}

export const BackofficeProjectRoutes = {
  projects: home.extend("/projects"),
  project: home.extend("/projects/:projectId"),
}
