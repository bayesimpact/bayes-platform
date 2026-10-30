import {
  MEMORY_MAX_LENGTH,
  resolveMemoryProposalsInputSchema,
} from "@caseai-connect/desk-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

/** The reworded fact, with the rule of the resolve route's `content`. */
const rewordSchema = z.object({
  content: resolveMemoryProposalsInputSchema.shape.decisions.element.shape.content.unwrap(),
})

export type MemoryRewordFormProps = {
  initialContent: string
  isSaving: boolean
  onSave: (content: string) => void
  onCancel: () => void
}

/** Rewords a fact the agent proposed, before the agent remembers it. */
export function MemoryRewordForm({
  initialContent,
  isSaving,
  onSave,
  onCancel,
}: MemoryRewordFormProps) {
  const { i18n } = useLingui()
  const contentId = useId()
  const form = useForm({
    resolver: zodResolver(rewordSchema),
    defaultValues: { content: initialContent },
  })
  const maxLength = i18n.number(MEMORY_MAX_LENGTH)
  const handleSubmit = form.handleSubmit((values) => onSave(values.content))

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-2">
      <Controller
        control={form.control}
        name="content"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={contentId} className="sr-only">
              <Trans>The fact to remember</Trans>
            </FieldLabel>
            <Textarea {...field} id={contentId} aria-invalid={fieldState.invalid} />
            {fieldState.error?.type === "too_big" ? (
              <FieldError>
                <Trans>Write the fact in {maxLength} characters at most.</Trans>
              </FieldError>
            ) : null}
            {fieldState.error?.type === "too_small" ? (
              <FieldError>
                <Trans>Write the fact to remember.</Trans>
              </FieldError>
            ) : null}
          </Field>
        )}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSaving}>
          <Trans comment="Saves the reworded fact in the agent's memory">Remember</Trans>
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <Trans>Cancel</Trans>
        </Button>
      </div>
    </form>
  )
}
