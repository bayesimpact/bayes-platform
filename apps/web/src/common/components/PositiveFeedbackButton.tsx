import { Button } from "@caseai-connect/ui/shad/button"
import { cn } from "@caseai-connect/ui/utils"
import { ThumbsUpIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import { createAgentMessageFeedback } from "@/studio/features/agent-message-feedback/agent-message-feedback.thunks"

/** A thumbs-up that rates an agent's reply as a good answer, in one click. */
export function PositiveFeedbackButton({ agentMessageId }: { agentMessageId: string }) {
  const { t } = useTranslation("agentMessageFeedback")
  const dispatch = useAppDispatch()
  const [isSent, setIsSent] = useState(false)
  const label = t("props.rating.positive")
  const handleClick = async () => {
    // A sent thumbs-up stays pressed, and enabled so it keeps its place in the tab order: a
    // second click sends nothing.
    if (isSent) return
    setIsSent(true)
    const result = await dispatch(
      createAgentMessageFeedback({ agentMessageId, rating: "positive" }),
    )
    if (createAgentMessageFeedback.rejected.match(result)) setIsSent(false)
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      aria-label={label}
      title={label}
      aria-pressed={isSent}
      onClick={() => void handleClick()}
    >
      <ThumbsUpIcon className={cn("size-3.5", isSent && "fill-current")} />
    </Button>
  )
}
