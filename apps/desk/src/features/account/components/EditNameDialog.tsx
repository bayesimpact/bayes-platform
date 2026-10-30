import { USER_NAME_MAX_LENGTH, updateMeInputSchema } from "@caseai-connect/desk-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useId } from "react"
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
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useUpdateName } from "../api/mutations"

export type EditNameDialogProps = {
  name: string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

/** Renames the person, as the people of their projects see them. */
export function EditNameDialog({ name, isOpen, onOpenChange }: EditNameDialogProps) {
  const { t, i18n } = useLingui()
  const inputId = useId()
  const updateName = useUpdateName()
  const form = useForm({
    resolver: zodResolver(updateMeInputSchema),
    values: { name },
  })
  const maxLength = i18n.number(USER_NAME_MAX_LENGTH)

  const handleSubmit = form.handleSubmit((values) =>
    updateName.mutate(values, {
      onSuccess: () => {
        toast.success(t`Your name was saved.`)
        onOpenChange(false)
      },
      onError: () => toast.error(t`Your name could not be saved. Try again.`),
    }),
  )

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              <Trans>Edit your name</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>The people of your projects see you by this name.</Trans>
            </DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={inputId}>
                  <Trans>Name</Trans>
                </FieldLabel>
                <Input
                  {...field}
                  id={inputId}
                  autoComplete="name"
                  aria-invalid={fieldState.invalid}
                  autoFocus
                />
                {fieldState.invalid ? (
                  <FieldError>
                    <Trans>Write a name of 1 to {maxLength} characters.</Trans>
                  </FieldError>
                ) : null}
              </Field>
            )}
          />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              <Trans>Cancel</Trans>
            </DialogClose>
            <Button type="submit" disabled={updateName.isPending}>
              <Trans>Save</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
