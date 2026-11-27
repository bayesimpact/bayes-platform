import type { ConversationParamsDto } from "@caseai-connect/chat-contracts"
import { presignAttachmentInputSchema } from "@caseai-connect/chat-contracts"
import { putFileToSignedUrl } from "@caseai-connect/frontend-lib"
import type { ChatOptions } from "./chat-options"

/**
 * Uploads a file to attach to the next message of a conversation: the API signs an upload URL,
 * then the bytes go straight to storage. Returns the document the message names.
 */
export async function uploadAttachment(
  { routes, api }: Pick<ChatOptions, "routes" | "api">,
  conversation: ConversationParamsDto,
  file: File,
  signal: AbortSignal,
): Promise<string> {
  const { attachmentDocumentId, uploadUrl } = await api.apiRequest(
    routes.conversation.presignAttachment,
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
