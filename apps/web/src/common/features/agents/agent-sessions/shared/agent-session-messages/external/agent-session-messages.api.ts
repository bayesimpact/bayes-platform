import {
  AgentSessionMessagesRoutes,
  type PresignAgentSessionMessageAttachmentDocumentRequestDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { IAgentSessionMessagesSpi } from "../agent-session-messages.spi"
import { fromDto } from "./agent-session-messages.mappers"

export default {
  getAll: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentSessionMessagesRoutes.live.getAll.response>(
      AgentSessionMessagesRoutes[payload.type].getAll.getPath(params),
    )
    return response.data.data.map(fromDto)
  },
  getOne: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentSessionMessagesRoutes.live.getOne.response>(
      AgentSessionMessagesRoutes[payload.type].getOne.getPath(params),
    )
    return fromDto(response.data.data)
  },
  getMcpAppHtml: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentSessionMessagesRoutes.live.getMcpAppHtml.response
    >(AgentSessionMessagesRoutes[payload.type].getMcpAppHtml.getPath(params))
    return response.data.data
  },
  uploadAttachmentDocument: async ({ file, payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentSessionMessagesRoutes.live.presignAttachmentDocument.response
    >(AgentSessionMessagesRoutes[payload.type].presignAttachmentDocument.getPath(params), {
      payload: {
        fileName: file.name,
        mimeType: file.type as PresignAgentSessionMessageAttachmentDocumentRequestDto["mimeType"],
        size: file.size,
      },
    } satisfies typeof AgentSessionMessagesRoutes.live.presignAttachmentDocument.request)

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
  getAttachmentDocumentTemporaryUrl: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentSessionMessagesRoutes.live.getAttachmentDocumentTemporaryUrl.response
    >(AgentSessionMessagesRoutes[payload.type].getAttachmentDocumentTemporaryUrl.getPath(params))

    return response.data.data
  },
} satisfies IAgentSessionMessagesSpi
