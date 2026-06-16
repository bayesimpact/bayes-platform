import { ResourceLibrariesRoutes, type ResourceLibraryDto } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { ResourceLibrary } from "../resource-libraries.models"
import type { IResourceLibrariesSpi } from "../resource-libraries.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ResourceLibrariesRoutes.getAll.response>(
      ResourceLibrariesRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.map(toResourceLibrary)
  },
  createOne: async ({ organizationId, projectId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ResourceLibrariesRoutes.createOne.response>(
      ResourceLibrariesRoutes.createOne.getPath({ organizationId, projectId }),
      { payload } satisfies typeof ResourceLibrariesRoutes.createOne.request,
    )
    return toResourceLibrary(response.data.data)
  },
  updateOne: async ({ organizationId, projectId, resourceLibraryId }, payload) => {
    const axios = getAxiosInstance()
    await axios.patch(
      ResourceLibrariesRoutes.updateOne.getPath({ organizationId, projectId, resourceLibraryId }),
      { payload } satisfies typeof ResourceLibrariesRoutes.updateOne.request,
    )
  },
  deleteOne: async ({ organizationId, projectId, resourceLibraryId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      ResourceLibrariesRoutes.deleteOne.getPath({ organizationId, projectId, resourceLibraryId }),
    )
  },
  addResource: async ({ organizationId, projectId, resourceLibraryId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ResourceLibrariesRoutes.addResource.response>(
      ResourceLibrariesRoutes.addResource.getPath({ organizationId, projectId, resourceLibraryId }),
      { payload } satisfies typeof ResourceLibrariesRoutes.addResource.request,
    )
    return toResourceLibrary(response.data.data)
  },
  updateResource: async ({ organizationId, projectId, resourceLibraryId, resourceId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.patch<typeof ResourceLibrariesRoutes.updateResource.response>(
      ResourceLibrariesRoutes.updateResource.getPath({
        organizationId,
        projectId,
        resourceLibraryId,
        resourceId,
      }),
      { payload } satisfies typeof ResourceLibrariesRoutes.updateResource.request,
    )
    return toResourceLibrary(response.data.data)
  },
  deleteResource: async ({ organizationId, projectId, resourceLibraryId, resourceId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      ResourceLibrariesRoutes.deleteResource.getPath({
        organizationId,
        projectId,
        resourceLibraryId,
        resourceId,
      }),
    )
  },
  uploadResourceFile: async ({ organizationId, projectId }, file) => {
    const axios = getAxiosInstance()
    const formData = new FormData()
    formData.append("file", file)
    const response = await axios.post<typeof ResourceLibrariesRoutes.uploadResourceFile.response>(
      ResourceLibrariesRoutes.uploadResourceFile.getPath({ organizationId, projectId }),
      formData,
    )
    return response.data.data
  },
} satisfies IResourceLibrariesSpi

export const toResourceLibrary = (dto: ResourceLibraryDto): ResourceLibrary => ({
  id: dto.id,
  title: dto.title,
  resources: dto.resources,
  organizationId: dto.organizationId,
  projectId: dto.projectId,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
})
