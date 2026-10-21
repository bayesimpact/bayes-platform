import {
  DeskAgentsRoutes,
  DeskOrganizationsRoutes,
  DeskProjectsRoutes,
} from "@caseai-connect/desk-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { organizationKeys, projectKeys } from "./keys"

/** The projects the signed-in person can read, with their permissions (`GET projects/mine`). */
export const myProjectsQueryOptions = () =>
  queryOptions({
    queryKey: projectKeys.mine(),
    queryFn: ({ signal }) => apiRequest(DeskProjectsRoutes.getAllMine, { signal }),
  })

/** The organizations the signed-in person can read (`GET organizations/mine`). */
export const myOrganizationsQueryOptions = () =>
  queryOptions({
    queryKey: organizationKeys.mine(),
    queryFn: ({ signal }) => apiRequest(DeskOrganizationsRoutes.getAllMine, { signal }),
  })

/** The published agents of a project the person is a member of, sorted by name. */
export const projectAgentsQueryOptions = (project: { id: string; organizationId: string }) =>
  queryOptions({
    queryKey: projectKeys.agents(project.id),
    queryFn: ({ signal }) =>
      apiRequest(DeskAgentsRoutes.getAllOfProject, {
        params: { organizationId: project.organizationId, projectId: project.id },
        signal,
      }),
  })
