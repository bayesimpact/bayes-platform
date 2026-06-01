import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@caseai-connect/ui/shad/field"
import { Item, ItemContent } from "@caseai-connect/ui/shad/item"
import { ScrollArea } from "@caseai-connect/ui/shad/scroll-area"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"
import { useAppDispatch } from "@/common/store/hooks"
import { createAgentMessageFeedback } from "@/studio/features/agent-message-feedback/agent-message-feedback.thunks"

export function FeedbackCreator({ message }: { message: AgentSessionMessage }) {
  const { t } = useTranslation("agentMessageFeedback", { keyPrefix: "create" })
  const [open, setOpen] = useState(false)
  const handleSuccess = () => {
    setOpen(false)
  }
  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ThumbsUpIcon className="size-3.5" /> <ThumbsDownIcon className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[40vh]">
          <Item variant="muted">
            <ItemContent>
              <MarkdownWrapper content={message.content} />
            </ItemContent>
          </Item>
        </ScrollArea>

        <CreateForm agentMessageId={message.id} onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({
  agentMessageId,
  onSuccess,
}: {
  agentMessageId: string
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [value, setValue] = useState("")
  const disabled = !value.trim()
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSuccess()
    dispatch(createAgentMessageFeedback({ agentMessageId, content: value }))
  }
  return (
    <div className="flex flex-col gap-2">
      <FieldGroup>
        <FieldSet>
          <Field>
            <FieldLabel htmlFor="description">{t("agentMessageFeedback:props.content")}</FieldLabel>
            <Textarea
              placeholder={t("agentMessageFeedback:props.placeholders.content")}
              value={value}
              // biome-ignore lint/suspicious/noExplicitAny: This is a React change event, which is always an any type
              onChange={(e: any) => setValue(e.target.value)}
            />
          </Field>

          <Field orientation="horizontal" className="justify-end">
            <Button disabled={disabled} onClick={handleSubmit}>
              <span className="capitalize-first">{t("actions:send")}</span>
            </Button>
          </Field>
        </FieldSet>
      </FieldGroup>
    </div>
  )
}
