import { useSuspenseQueries } from "@tanstack/react-query"
import {
  myOrganizationsQueryOptions,
  myProjectsQueryOptions,
  projectAgentsQueryOptions,
} from "../api/queries"
import { type DeskProjectAgents, groupDeskAgents } from "../desk-agents"
import { listDeskProjects } from "../desk-projects"

/** The agents of every Desk project, from the queries `loadDeskAgents` started. */
export function useDeskAgentGroups(): DeskProjectAgents[] {
  const projects = useSuspenseQueries({
    queries: [myProjectsQueryOptions(), myOrganizationsQueryOptions()],
    combine: ([myProjects, myOrganizations]) =>
      listDeskProjects(myProjects.data, myOrganizations.data),
  })
  return useSuspenseQueries({
    queries: projects.map((project) =>
      projectAgentsQueryOptions({ id: project.id, organizationId: project.organization.id }),
    ),
    combine: (results) =>
      groupDeskAgents(
        projects,
        results.map((result) => result.data),
      ),
  })
}
