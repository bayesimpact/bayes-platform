import { MEMORY_MAX_LENGTH } from "@caseai-connect/desk-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

/** The reworded fact, with the rule of the resolve route's `content`. */
const rewordSchema = z.object({
  content: z.string().trim().min(1).max(MEMORY_MAX_LENGTH),
})

type RewordValues = z.input<typeof rewordSchema>

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
  const { t } = useLingui()
  const form = useForm<RewordValues>({
    resolver: zodResolver(rewordSchema),
    defaultValues: { content: initialContent },
  })
  const handleSubmit = form.handleSubmit((values) => onSave(values.content.trim()))

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-2">
      <Controller
        control={form.control}
        name="content"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="memory-content" className="sr-only">
              {t`The fact to remember`}
            </FieldLabel>
            <Textarea {...field} id="memory-content" aria-invalid={fieldState.invalid} />
            {fieldState.invalid ? (
              <FieldError>
                <Trans>Write the fact in 300 characters at most.</Trans>
              </FieldError>
            ) : null}
          </Field>
        )}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSaving}>
          <Trans>Remember</Trans>
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <Trans>Cancel</Trans>
        </Button>
      </div>
    </form>
  )
}
