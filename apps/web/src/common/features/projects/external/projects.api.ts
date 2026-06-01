import {
  ProjectAgentCategoriesRoutes,
  type ProjectAgentCategoryDto,
  type ProjectDto,
  ProjectsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { Project, ProjectAgentCategory } from "../projects.models"
import type { IProjectsSpi } from "../projects.spi"

export default {
  createOne: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ProjectsRoutes.createOne.response>(
      ProjectsRoutes.createOne.getPath(params),
      { payload } satisfies typeof ProjectsRoutes.createOne.request,
    )
    return toProject(response.data.data)
  },
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectsRoutes.getAll.response>(
      ProjectsRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toProject)
  },
  updateOne: async (params, payload) => {
    const axios = getAxiosInstance()
    await axios.patch(ProjectsRoutes.updateOne.getPath(params), {
      payload,
    } satisfies typeof ProjectsRoutes.updateOne.request)
  },
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete(ProjectsRoutes.deleteOne.getPath(params))
  },
  addProjectAgentCategory: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ProjectAgentCategoriesRoutes.createOne.response>(
      ProjectAgentCategoriesRoutes.createOne.getPath(params),
      { payload } satisfies typeof ProjectAgentCategoriesRoutes.createOne.request,
    )
    return toProjectAgentCategory(response.data.data)
  },
  deleteProjectAgentCategory: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete(ProjectAgentCategoriesRoutes.deleteOne.getPath(params))
  },
} satisfies IProjectsSpi

export const toProjectAgentCategory = (dto: ProjectAgentCategoryDto): ProjectAgentCategory => ({
  id: dto.id,
  name: dto.name,
})

export const toProject = (dto: ProjectDto): Project => ({
  id: dto.id,
  name: dto.name,
  organizationId: dto.organizationId,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  featureFlags: dto.featureFlags,
  agentCategories: dto.agentCategories,
})
