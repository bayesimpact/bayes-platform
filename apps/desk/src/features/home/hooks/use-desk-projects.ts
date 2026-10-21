import { useSuspenseQueries } from "@tanstack/react-query"
import { myOrganizationsQueryOptions, myProjectsQueryOptions } from "../api/queries"
import { type DeskProject, listDeskProjects } from "../desk-projects"

/** The projects the Desk's home lists, from the two queries its loader started. */
export function useDeskProjects(): DeskProject[] {
  return useSuspenseQueries({
    queries: [myProjectsQueryOptions(), myOrganizationsQueryOptions()],
    combine: ([projects, organizations]) => listDeskProjects(projects.data, organizations.data),
  })
}
