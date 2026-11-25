import type { ConversationParamsDto } from "@bayes-platform/eval-contracts"
import {
  EvalConversationsRoutes,
  presignAttachmentInputSchema,
} from "@bayes-platform/eval-contracts"
import { apiRequest } from "@/lib/api-client"
import { putFileToSignedUrl } from "@/lib/upload-file"

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
    EvalConversationsRoutes.presignAttachment,
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
