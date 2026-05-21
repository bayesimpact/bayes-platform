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
import { Input } from "@caseai-connect/ui/shad/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusCircleIcon, XIcon } from "lucide-react"
import { type KeyboardEvent, useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { createInvitationsForTarget } from "@/studio/features/invitations/invitations.thunks"

export function MembersCreator({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="text-base">
          {t("actions:invite")}
          <PlusCircleIcon className="ml-2 size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("projectMembership:create.title")}</DialogTitle>
          <DialogDescription>{t("projectMembership:create.description")}</DialogDescription>
        </DialogHeader>
        <CreateForm isOpen={open} projectId={projectId} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({
  isOpen,
  projectId,
  onClose,
}: {
  isOpen: boolean
  projectId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [inputEmail, setInputEmail] = useState("")
  const [inputError, setInputError] = useState<string | undefined>()

  const emailsSchema = z.object({
    emails: z.array(z.string().email(t("projectMembership:props.validation.emailInvalid"))),
  })

  type FormValues = z.infer<typeof emailsSchema>

  const { handleSubmit, control, setValue, reset, clearErrors } = useForm<FormValues>({
    resolver: zodResolver(emailsSchema),
    defaultValues: { emails: [] },
  })

  const emails = useWatch({ control, name: "emails" })

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      reset({ emails: [] })
      setInputEmail("")
      setInputError(undefined)
      clearErrors()
    }
  }, [isOpen, reset, clearErrors])

  const handleAddEmail = () => {
    const trimmedEmail = inputEmail.trim().toLowerCase()

    if (!trimmedEmail) return

    // Validate email format
    const emailValidation = z.string().email().safeParse(trimmedEmail)
    if (!emailValidation.success) {
      setInputError(t("projectMembership:props.validation.emailInvalid"))
      return
    }

    // Check for duplicates
    if (emails.includes(trimmedEmail)) {
      setInputError(t("projectMembership:props.validation.emailDuplicate"))
      return
    }

    // Add email to the array
    setValue("emails", [...emails, trimmedEmail], { shouldValidate: true })
    setInputEmail("")
    setInputError(undefined)
  }

  const handleRemoveEmail = (emailToRemove: string) => {
    setValue(
      "emails",
      emails.filter((email) => email !== emailToRemove),
      { shouldValidate: true },
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      handleAddEmail()
    }
  }

  const handleFormSubmit = (data: FormValues) => {
    if (data.emails.length === 0) return
    dispatch(
      createInvitationsForTarget({
        targetType: "project",
        targetId: projectId,
        emails: data.emails,
        refreshTarget: { targetType: "project", targetId: projectId },
      }),
    )
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <FieldGroup>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email-input">{t("projectMembership:create.label")}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="email-input"
                  type="email"
                  placeholder={t("projectMembership:create.placeholder")}
                  value={inputEmail}
                  onChange={(e) => {
                    setInputEmail(e.target.value)
                    setInputError(undefined)
                  }}
                  onKeyDown={handleKeyDown}
                  aria-invalid={inputError ? "true" : "false"}
                />
                <Button type="button" variant="outline" onClick={handleAddEmail}>
                  {t("actions:add")}
                </Button>
              </div>
              {inputError && <p className="text-sm text-destructive">{inputError}</p>}
            </Field>

            {emails.length > 0 && (
              <Field>
                <div className="flex flex-wrap gap-2">
                  {emails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(email)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </Field>
            )}

            <Field orientation="horizontal" className="justify-end">
              <Button type="submit" disabled={emails.length === 0}>
                {t("actions:send", { count: emails.length })}
              </Button>
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>
    </form>
  )
}
