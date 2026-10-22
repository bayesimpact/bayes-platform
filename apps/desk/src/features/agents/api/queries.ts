import {
  DeskAgentsRoutes,
  DeskOrganizationsRoutes,
  DeskProjectsRoutes,
} from "@caseai-connect/desk-contracts"
import { type QueryClient, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { type DeskProjectAgents, groupDeskAgents } from "../desk-agents"
import { listDeskProjects } from "../desk-projects"
import { deskAgentKeys } from "./keys"

/**
 * The agents the person can use in the Desk, grouped by project: the projects
 * (`GET projects/mine`) and organizations (`GET organizations/mine`) in parallel, then the
 * published agents of every Desk project in parallel. One key holds them all, so a new project
 * never leaves a reader waiting on a query of its own that does not exist yet.
 */
export const deskAgentsQueryOptions = () =>
  queryOptions({
    queryKey: deskAgentKeys.all,
    queryFn: async ({ signal }): Promise<DeskProjectAgents[]> => {
      const [projects, organizations] = await Promise.all([
        apiRequest(DeskProjectsRoutes.getAllMine, { signal }),
        apiRequest(DeskOrganizationsRoutes.getAllMine, { signal }),
      ])
      const deskProjects = listDeskProjects(projects, organizations)
      const agentsOfProjects = await Promise.all(
        deskProjects.map((project) =>
          apiRequest(DeskAgentsRoutes.getAllOfProject, {
            params: { organizationId: project.organization.id, projectId: project.id },
            signal,
          }),
        ),
      )
      return groupDeskAgents(deskProjects, agentsOfProjects)
    },
  })

/**
 * Loads again the person's agents, after they joined a project or an agent: the loaders read them
 * again once invalidated, when the page reloads its data.
 */
export async function refreshDeskAgents(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: deskAgentsQueryOptions().queryKey })
}
