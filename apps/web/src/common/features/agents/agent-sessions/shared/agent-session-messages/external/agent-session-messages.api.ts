import {
  type AgentSessionMessageDto,
  AgentSessionMessagesRoutes,
  type PresignAgentSessionMessageAttachmentDocumentRequestDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AgentSessionMessage } from "../agent-session-messages.models"
import type { IAgentSessionMessagesSpi } from "../agent-session-messages.spi"

export default {
  getAll: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentSessionMessagesRoutes.getAll.response>(
      AgentSessionMessagesRoutes.getAll.getPath(params),
      { payload } satisfies typeof AgentSessionMessagesRoutes.getAll.request,
    )
    return response.data.data.map(fromDto)
  },
  getOne: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentSessionMessagesRoutes.getOne.response>(
      AgentSessionMessagesRoutes.getOne.getPath(params),
      { payload } satisfies typeof AgentSessionMessagesRoutes.getOne.request,
    )
    return fromDto(response.data.data)
  },
  uploadAttachmentDocument: async ({ file, payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentSessionMessagesRoutes.presignAttachmentDocument.response
    >(AgentSessionMessagesRoutes.presignAttachmentDocument.getPath(params), {
      payload: {
        type: payload.type,
        fileName: file.name,
        mimeType: file.type as PresignAgentSessionMessageAttachmentDocumentRequestDto["mimeType"],
        size: file.size,
      },
    } satisfies typeof AgentSessionMessagesRoutes.presignAttachmentDocument.request)

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
      typeof AgentSessionMessagesRoutes.getAttachmentDocumentTemporaryUrl.response
    >(AgentSessionMessagesRoutes.getAttachmentDocumentTemporaryUrl.getPath(params), {
      payload,
    } satisfies typeof AgentSessionMessagesRoutes.getAttachmentDocumentTemporaryUrl.request)

    return response.data.data
  },
} satisfies IAgentSessionMessagesSpi

// `AgentSessionMessage` is a bare alias of `AgentSessionMessageDto` (see agent-session-messages.models.ts),
// so there is no actual transformation to perform here. Spreading rather than enumerating fields
// means a field added to the DTO (like `agentSettings` was) is carried through automatically instead
// of silently dropped until someone remembers to list it here.
const fromDto = (dto: AgentSessionMessageDto): AgentSessionMessage => ({ ...dto })
