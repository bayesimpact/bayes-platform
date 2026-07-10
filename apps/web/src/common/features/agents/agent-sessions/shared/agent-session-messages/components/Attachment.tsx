import {
  AttachmentAction,
  AttachmentActions,
  Attachment as AttachmentCard,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from "@caseai-connect/ui/shad/attachment"
import { ExternalLinkIcon, FileTextIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { useAppDispatch } from "@/common/store/hooks"
import { getAttachmentDocumentTemporaryUrl } from "../agent-session-messages.thunks"

export function Attachment({ message }: { message: AgentSessionMessage }) {
  const { t } = useTranslation("agentSessionMessage")
  const dispatch = useAppDispatch()

  const [url, setUrl] = useState<string>()

  const loadDocument = useCallback(async () => {
    const attachmentDocumentId = message.attachmentDocumentId

    if (!attachmentDocumentId) return

    const res = await dispatch(getAttachmentDocumentTemporaryUrl({ attachmentDocumentId })).unwrap()
    if (res?.url) setUrl(res.url)
  }, [dispatch, message.attachmentDocumentId])

  useEffect(() => {
    loadDocument()
  }, [loadDocument])

  if (!message.attachmentDocumentId) return null

  return (
    <AttachmentCard size="sm" orientation="horizontal">
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{t("attachment")}</AttachmentTitle>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction
          aria-label={t("attachment")}
          disabled={!url}
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLinkIcon />
        </AttachmentAction>
      </AttachmentActions>
    </AttachmentCard>
  )
}
