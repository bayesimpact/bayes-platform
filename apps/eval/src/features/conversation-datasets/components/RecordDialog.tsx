import {
  CONVERSATION_DATASET_RECORD_MAX_LENGTH,
  type ConversationDatasetRecordInputDto,
  conversationDatasetRecordInputSchema,
} from "@bayes-platform/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans } from "@lingui/react/macro"
import { type ReactNode, useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export type RecordDialogProps = {
  title: ReactNode
  submitLabel: ReactNode
  /** What the fields start with: the record's texts, or none for a new one. */
  defaultValues: ConversationDatasetRecordInputDto
  isPending: boolean
  onSubmit: (record: ConversationDatasetRecordInputDto) => void
  onClose: () => void
}

/** Asks a record's input and expected output, to add it or to change it. Its owner mounts it while it shows. */
export function RecordDialog({
  title,
  submitLabel,
  defaultValues,
  isPending,
  onSubmit,
  onClose,
}: RecordDialogProps) {
  const inputId = useId()
  const expectedOutputId = useId()
  const form = useForm({
    resolver: zodResolver(conversationDatasetRecordInputSchema),
    defaultValues,
  })
  const handleSubmit = form.handleSubmit((values) => onSubmit(values))
  const maxLength = CONVERSATION_DATASET_RECORD_MAX_LENGTH
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            <Trans>
              An evaluation sends the input to the agent, then grades its answer against the
              expected output.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
          noValidate
        >
          <Controller
            control={form.control}
            name="input"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={inputId}>
                  <Trans comment="What an evaluation sends to the agent">Input</Trans>
                </FieldLabel>
                <Textarea
                  {...field}
                  id={inputId}
                  autoFocus
                  maxLength={maxLength}
                  className="max-h-48"
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  <Trans>The message a person would send to the agent.</Trans>
                </FieldDescription>
                {fieldState.invalid ? (
                  <FieldError>
                    <Trans>Write the input.</Trans>
                  </FieldError>
                ) : null}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="expectedOutput"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={expectedOutputId}>
                  <Trans comment="The answer an evaluation expects from the agent">
                    Expected output
                  </Trans>
                </FieldLabel>
                <Textarea
                  {...field}
                  id={expectedOutputId}
                  maxLength={maxLength}
                  className="max-h-48"
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  <Trans>What a good answer says.</Trans>
                </FieldDescription>
                {fieldState.invalid ? (
                  <FieldError>
                    <Trans>Write the expected output.</Trans>
                  </FieldError>
                ) : null}
              </Field>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={isPending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
