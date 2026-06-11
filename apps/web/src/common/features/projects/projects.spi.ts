import type { Project, ProjectSessionCategory } from "./projects.models"

export interface IProjectsSpi {
  createOne: (
    params: {
      organizationId: string
    },
    payload: Pick<Project, "name">,
  ) => Promise<Project>
  getAll: (params: { organizationId: string }) => Promise<Project[]>
  updateOne: (
    params: {
      organizationId: string
      projectId: string
    },
    payload: Pick<Project, "name">,
  ) => Promise<void>
  deleteOne: (params: { organizationId: string; projectId: string }) => Promise<void>
  addProjectSessionCategory: (
    params: { organizationId: string; projectId: string },
    payload: { name: string; assignToAllConversationalAgents: boolean },
  ) => Promise<ProjectSessionCategory>
  deleteProjectSessionCategory: (params: {
    organizationId: string
    projectId: string
    categoryId: string
  }) => Promise<void>
}
