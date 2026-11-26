import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import {
  DeskConversationsRoutes,
  presignAttachmentInputSchema,
} from "@caseai-connect/desk-contracts"
import { putFileToSignedUrl } from "@caseai-connect/frontend-lib"
import { apiRequest } from "@/lib/api-client"

/**
 * Uploads a file to attach to the next message of a conversation: the API signs an upload URL,
 * then the bytes go straight to storage. Returns the document the message names.
 */
export async function uploadAttachment(
  conversation: ConversationParamsDto,
  file: File,
  signal: AbortSignal,
): Promise<string> {
  const { attachmentDocumentId, uploadUrl } = await apiRequest(
    DeskConversationsRoutes.presignAttachment,
    {
      params: conversation,
      body: presignAttachmentInputSchema.parse({
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      }),
      signal,
    },
  )
  await putFileToSignedUrl(uploadUrl, file, file.type, signal)
  return attachmentDocumentId
}
