import type { Project, ProjectAgentCategory } from "./projects.models"

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
  addProjectAgentCategory: (
    params: { organizationId: string; projectId: string },
    payload: { name: string; assignToAllConversationalAgents: boolean },
  ) => Promise<ProjectAgentCategory>
  deleteProjectAgentCategory: (params: {
    organizationId: string
    projectId: string
    categoryId: string
  }) => Promise<void>
}
