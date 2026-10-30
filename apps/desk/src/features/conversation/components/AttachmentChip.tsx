import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { ExternalLinkIcon, FileIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { openBlankTab } from "@/lib/safe-url"
import { useOpenAttachment } from "../api/mutations"
import type { ChatAttachment } from "../chat-messages"

export type AttachmentChipProps = {
  conversation: ConversationParamsDto
  attachment: ChatAttachment
}

/**
 * The file a person attached to a message. Its name shows while the message is local; the API
 * does not send it back, so a persisted message reads "Attachment", and its file opens.
 */
export function AttachmentChip({ conversation, attachment }: AttachmentChipProps) {
  const { t } = useLingui()
  const openAttachment = useOpenAttachment(conversation)
  const name = attachment.fileName ?? t`Attachment`
  const documentId = attachment.documentId

  const handleOpen = () => {
    if (!documentId) return
    const tab = openBlankTab()
    openAttachment.mutate(
      { attachmentDocumentId: documentId, tab },
      { onError: () => toast.error(t`The file could not be opened. Try again.`) },
    )
  }

  return (
    <div className="flex items-center gap-2 self-end rounded-lg border bg-background px-2 py-1 text-xs">
      <FileIcon aria-hidden className="size-4 shrink-0" />
      <span className="max-w-48 truncate">{name}</span>
      {documentId ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t`Open ${name}`}
          disabled={openAttachment.isPending}
          onClick={handleOpen}
        >
          <ExternalLinkIcon aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
