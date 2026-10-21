// Route helper

// Account
export * from "./account/account.dto"
export { DeskAccountRoutes } from "./account/account.routes"
// Agent sessions
export * from "./agent-sessions/agent-sessions.dto"
export { DeskAgentSessionsRoutes } from "./agent-sessions/agent-sessions.routes"
// Agents
export * from "./agents/agents.dto"
export { DeskAgentsRoutes } from "./agents/agents.routes"
// Common
export * from "./common/error.dto"
export * from "./define-schema-route"

// Organizations
export * from "./organizations/organizations.dto"
export { DeskOrganizationsRoutes } from "./organizations/organizations.routes"

// Projects
export * from "./projects/projects.dto"
export { DeskProjectsRoutes } from "./projects/projects.routes"
