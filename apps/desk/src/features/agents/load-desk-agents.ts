import type { QueryClient } from "@tanstack/react-query"
import {
  myOrganizationsQueryOptions,
  myProjectsQueryOptions,
  projectAgentsQueryOptions,
} from "./api/queries"
import { type DeskProjectAgents, groupDeskAgents } from "./desk-agents"
import { listDeskProjects } from "./desk-projects"

/**
 * Loads, for a route's `beforeLoad` or loader, the projects and organizations in parallel, then
 * the agents of every Desk project in parallel. The queries stay in the cache for the components.
 */
export async function loadDeskAgents(queryClient: QueryClient): Promise<DeskProjectAgents[]> {
  const [projects, organizations] = await Promise.all([
    queryClient.query({ ...myProjectsQueryOptions(), staleTime: "static" }),
    queryClient.query({ ...myOrganizationsQueryOptions(), staleTime: "static" }),
  ])
  const deskProjects = listDeskProjects(projects, organizations)
  const agentsOfProjects = await Promise.all(
    deskProjects.map((project) =>
      queryClient.query({
        ...projectAgentsQueryOptions({ id: project.id, organizationId: project.organization.id }),
        staleTime: "static",
      }),
    ),
  )
  return groupDeskAgents(deskProjects, agentsOfProjects)
}
