import {
  AgentSessionMessagesRoutes,
  type PresignAgentSessionMessageAttachmentDocumentRequestDto,
} from "@bayes-platform/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { IAgentSessionMessagesSpi } from "../agent-session-messages.spi"
import { fromDto } from "./agent-session-messages.mappers"

export default {
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentSessionMessagesRoutes.playground.getAll.response>(
      AgentSessionMessagesRoutes.playground.getAll.getPath(params),
    )
    return response.data.data.map(fromDto)
  },
  getOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentSessionMessagesRoutes.playground.getOne.response>(
      AgentSessionMessagesRoutes.playground.getOne.getPath(params),
    )
    return fromDto(response.data.data)
  },
  getMcpAppHtml: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentSessionMessagesRoutes.playground.getMcpAppHtml.response
    >(AgentSessionMessagesRoutes.playground.getMcpAppHtml.getPath(params))
    return response.data.data
  },
  uploadAttachmentDocument: async ({ file, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentSessionMessagesRoutes.playground.presignAttachmentDocument.response
    >(AgentSessionMessagesRoutes.playground.presignAttachmentDocument.getPath(params), {
      payload: {
        fileName: file.name,
        mimeType: file.type as PresignAgentSessionMessageAttachmentDocumentRequestDto["mimeType"],
        size: file.size,
      },
    } satisfies typeof AgentSessionMessagesRoutes.playground.presignAttachmentDocument.request)

    const uploadResponse = await fetch(response.data.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error(`Attachment upload failed: ${uploadResponse.status}`)
    }

    return { attachmentDocumentId: response.data.data.attachmentDocumentId }
  },
  getAttachmentDocumentTemporaryUrl: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentSessionMessagesRoutes.playground.getAttachmentDocumentTemporaryUrl.response
    >(AgentSessionMessagesRoutes.playground.getAttachmentDocumentTemporaryUrl.getPath(params))

    return response.data.data
  },
} satisfies IAgentSessionMessagesSpi
