import {
  CONVERSATION_DATASET_NAME_MIN_LENGTH,
  conversationDatasetNameInputSchema,
} from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type DatasetNameDialogProps = {
  title: ReactNode
  description: ReactNode
  submitLabel: ReactNode
  /** The name the field starts with: the dataset's, or none for a new one. */
  defaultName: string
  isPending: boolean
  onSubmit: (name: string) => void
  onClose: () => void
}

/** Asks the name of a dataset, to create it or to rename it. Its owner mounts it while it shows. */
export function DatasetNameDialog({
  title,
  description,
  submitLabel,
  defaultName,
  isPending,
  onSubmit,
  onClose,
}: DatasetNameDialogProps) {
  const { t } = useLingui()
  const nameId = useId()
  const form = useForm({
    resolver: zodResolver(conversationDatasetNameInputSchema),
    defaultValues: { name: defaultName },
  })
  const handleSubmit = form.handleSubmit((values) => onSubmit(values.name))
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
          noValidate
        >
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={nameId}>
                  <Trans comment="The name of a dataset">Name</Trans>
                </FieldLabel>
                <Input
                  {...field}
                  id={nameId}
                  autoFocus
                  placeholder={t`e.g. Pricing questions`}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? (
                  <FieldError>
                    <Plural
                      value={CONVERSATION_DATASET_NAME_MIN_LENGTH}
                      one="Give the dataset a name of # character or more."
                      other="Give the dataset a name of # characters or more."
                    />
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
