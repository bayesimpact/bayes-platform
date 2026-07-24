import type { MyProject, Project, ProjectAgentSessionCategory } from "./projects.models"

export interface IProjectsSpi {
  createOne: (
    params: {
      organizationId: string
    },
    payload: Pick<Project, "name">,
  ) => Promise<Project>
  getAll: (params: { organizationId: string }) => Promise<Project[]>
  getAllMine: () => Promise<MyProject[]>
  updateOne: (
    params: {
      organizationId: string
      projectId: string
    },
    payload: Pick<Project, "name">,
  ) => Promise<void>
  deleteOne: (params: { organizationId: string; projectId: string }) => Promise<void>
  addProjectAgentSessionCategory: (
    params: { organizationId: string; projectId: string },
    payload: { name: string; assignToAllConversationalAgents: boolean },
  ) => Promise<ProjectAgentSessionCategory>
  deleteProjectAgentSessionCategory: (params: {
    organizationId: string
    projectId: string
    categoryId: string
  }) => Promise<void>
}
