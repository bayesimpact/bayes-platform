import { type DocumentTagDto, DocumentTagsRoutes } from "@bayes-platform/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { DocumentTag } from "../document-tags.models"
import type { IDocumentTagsSpi } from "../document-tags.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof DocumentTagsRoutes.getAll.response>(
      DocumentTagsRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.map(toDocumentTag)
  },
  createOne: async ({ organizationId, projectId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof DocumentTagsRoutes.createOne.response>(
      DocumentTagsRoutes.createOne.getPath({ organizationId, projectId }),
      { payload } satisfies typeof DocumentTagsRoutes.createOne.request,
    )
    return toDocumentTag(response.data.data)
  },
  updateOne: async ({ organizationId, projectId, documentTagId }, payload) => {
    const axios = getAxiosInstance()
    await axios.patch(
      DocumentTagsRoutes.updateOne.getPath({ organizationId, projectId, documentTagId }),
      { payload } satisfies typeof DocumentTagsRoutes.updateOne.request,
    )
  },
  deleteOne: async ({ organizationId, projectId, documentTagId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      DocumentTagsRoutes.deleteOne.getPath({ organizationId, projectId, documentTagId }),
    )
  },
} satisfies IDocumentTagsSpi

export const toDocumentTag = (dto: DocumentTagDto): DocumentTag => ({
  childrenIds: dto.childrenIds,
  createdAt: dto.createdAt,
  description: dto.description,
  id: dto.id,
  name: dto.name,
  organizationId: dto.organizationId,
  parentId: dto.parentId,
  projectId: dto.projectId,
  updatedAt: dto.updatedAt,
})
