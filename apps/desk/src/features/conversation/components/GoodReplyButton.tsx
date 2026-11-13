import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { ThumbsUpIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSendFeedback } from "../api/mutations"

export type GoodReplyButtonProps = {
  conversation: ConversationParamsDto
  agentMessageId: string
}

/** Gives a thumbs-up to one of the agent's replies, in one click, for the people who run it. */
export function GoodReplyButton({ conversation, agentMessageId }: GoodReplyButtonProps) {
  const { t } = useLingui()
  const [isSent, setIsSent] = useState(false)
  const sendFeedback = useSendFeedback(conversation)
  const label = t({ message: "Good reply", comment: "The thumbs-up button under a reply" })

  const handleClick = () =>
    sendFeedback.mutate(
      { agentMessageId, feedback: { rating: "positive" } },
      {
        onSuccess: () => {
          setIsSent(true)
          toast.success(t`Thank you for your feedback.`)
        },
        onError: () => toast.error(t`Your feedback could not be sent. Try again.`),
      },
    )

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            aria-pressed={isSent}
            disabled={isSent || sendFeedback.isPending}
            onClick={handleClick}
          />
        }
      >
        <ThumbsUpIcon aria-hidden className={cn("size-3.5", isSent && "fill-current")} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
