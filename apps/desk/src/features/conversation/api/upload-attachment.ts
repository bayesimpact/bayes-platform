import {
  DeskConversationsRoutes,
  presignAttachmentInputSchema,
} from "@caseai-connect/desk-contracts"
import { apiRequest } from "@/lib/api-client"
import type { ConversationRef } from "../conversation-ref"

/**
 * Uploads a file to attach to the next message of a conversation: the API signs an upload URL,
 * then the bytes go straight to storage. Returns the document the message names.
 */
export async function uploadAttachment(
  conversation: ConversationRef,
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
  // The URL is signed with the content type: storage refuses an upload without the same one.
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
    signal,
  })
  if (!response.ok) throw new Error(`The storage answered ${response.status} to the upload`)
  return attachmentDocumentId
}
