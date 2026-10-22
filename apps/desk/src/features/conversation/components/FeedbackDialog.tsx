import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import {
  MESSAGE_FEEDBACK_MAX_LENGTH,
  messageFeedbackInputSchema,
} from "@caseai-connect/desk-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { FlagIcon } from "lucide-react"
import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSendFeedback } from "../api/mutations"

export type FeedbackDialogProps = {
  conversation: ConversationParamsDto
  agentMessageId: string
}

/** Reports a problem with one of the agent's replies, for the people who run the agent. */
export function FeedbackDialog({ conversation, agentMessageId }: FeedbackDialogProps) {
  const { t, i18n } = useLingui()
  const contentId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const sendFeedback = useSendFeedback(conversation)
  const form = useForm({
    resolver: zodResolver(messageFeedbackInputSchema),
    defaultValues: { content: "" },
  })
  const maxLength = i18n.number(MESSAGE_FEEDBACK_MAX_LENGTH)

  const handleSubmit = form.handleSubmit((values) =>
    sendFeedback.mutate(
      { agentMessageId, content: values.content },
      {
        onSuccess: () => {
          toast.success(t`Thank you. Your report was sent.`)
          form.reset()
          setIsOpen(false)
        },
        onError: () => toast.error(t`The report could not be sent. Try again.`),
      },
    ),
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={<Button variant="ghost" size="icon-xs" aria-label={t`Report a problem`} />}
            />
          }
        >
          <FlagIcon aria-hidden className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>
          <Trans>Report a problem</Trans>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              <Trans>Report a problem with this reply</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>The people who run this agent read every report to improve it.</Trans>
            </DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="content"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={contentId}>
                  <Trans>What went wrong?</Trans>
                </FieldLabel>
                <Textarea
                  {...field}
                  id={contentId}
                  aria-invalid={fieldState.invalid}
                  className="min-h-28"
                />
                {fieldState.invalid ? (
                  <FieldError>
                    <Trans>
                      Describe the problem in a few words, up to {maxLength} characters.
                    </Trans>
                  </FieldError>
                ) : null}
              </Field>
            )}
          />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              <Trans>Cancel</Trans>
            </DialogClose>
            <Button type="submit" disabled={sendFeedback.isPending}>
              <Trans>Send the report</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
