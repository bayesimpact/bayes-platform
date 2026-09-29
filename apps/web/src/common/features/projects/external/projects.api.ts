import {
  type MyProjectDto,
  ProjectAgentSessionCategoriesRoutes,
  type ProjectAgentSessionCategoryDto,
  type ProjectDto,
  ProjectsRoutes,
  type RetentionSweepRunDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type {
  MyProject,
  Project,
  ProjectAgentSessionCategory,
  RetentionSweepRun,
  RetentionSweepRuns,
} from "../projects.models"
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
  getAllMine: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectsRoutes.getAllMine.response>(
      ProjectsRoutes.getAllMine.getPath(),
    )
    return response.data.data.map(toMyProject)
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
  getRetentionSweepRuns: async (params): Promise<RetentionSweepRuns> => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectsRoutes.getRetentionSweepRuns.response>(
      ProjectsRoutes.getRetentionSweepRuns.getPath(params),
    )
    const { nextRunAt, runs } = response.data.data
    return { nextRunAt, runs: runs.map(toRetentionSweepRun) }
  },
  addProjectAgentSessionCategory: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ProjectAgentSessionCategoriesRoutes.createOne.response
    >(ProjectAgentSessionCategoriesRoutes.createOne.getPath(params), {
      payload,
    } satisfies typeof ProjectAgentSessionCategoriesRoutes.createOne.request)
    return toProjectAgentSessionCategory(response.data.data)
  },
  deleteProjectAgentSessionCategory: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete(ProjectAgentSessionCategoriesRoutes.deleteOne.getPath(params))
  },
} satisfies IProjectsSpi

export const toProjectAgentSessionCategory = (
  dto: ProjectAgentSessionCategoryDto,
): ProjectAgentSessionCategory => ({
  id: dto.id,
  name: dto.name,
})

export const toMyProject = (dto: MyProjectDto): MyProject => ({
  id: dto.id,
  name: dto.name,
  organizationId: dto.organizationId,
  featureFlags: dto.featureFlags,
  permissions: dto.permissions,
})

export const toProject = (dto: ProjectDto): Project => ({
  id: dto.id,
  name: dto.name,
  organizationId: dto.organizationId,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  featureFlags: dto.featureFlags,
  agentSessionCategories: dto.agentSessionCategories,
  conversationRetentionDays: dto.conversationRetentionDays,
  permissions: dto.permissions,
})

function toRetentionSweepRun(dto: RetentionSweepRunDto): RetentionSweepRun {
  return {
    id: dto.id,
    ranAt: dto.ranAt,
    purgedCount: dto.purgedCount,
    status: dto.status,
    report: dto.report,
  }
}
