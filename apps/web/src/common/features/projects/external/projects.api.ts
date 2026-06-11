import {
  type ProjectDto,
  ProjectSessionCategoriesRoutes,
  type ProjectSessionCategoryDto,
  ProjectsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { Project, ProjectSessionCategory } from "../projects.models"
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
  addProjectSessionCategory: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ProjectSessionCategoriesRoutes.createOne.response>(
      ProjectSessionCategoriesRoutes.createOne.getPath(params),
      { payload } satisfies typeof ProjectSessionCategoriesRoutes.createOne.request,
    )
    return toProjectSessionCategory(response.data.data)
  },
  deleteProjectSessionCategory: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete(ProjectSessionCategoriesRoutes.deleteOne.getPath(params))
  },
} satisfies IProjectsSpi

export const toProjectSessionCategory = (
  dto: ProjectSessionCategoryDto,
): ProjectSessionCategory => ({
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
  agentSessionCategories: dto.agentSessionCategories,
})
