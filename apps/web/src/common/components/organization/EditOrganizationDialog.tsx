import { updateOrganizationSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Input } from "@caseai-connect/ui/shad/input"
import { Label } from "@caseai-connect/ui/shad/label"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import type { Organization } from "@/common/features/organizations/organizations.models"
import { updateOrganization } from "@/common/features/organizations/organizations.thunks"
import { useAppDispatch } from "@/common/store/hooks"

type FormValues = z.infer<typeof updateOrganizationSchema>

type Props = {
  open: boolean
  onClose: () => void
  organization: Organization
}

export function EditOrganizationDialog({ open, onClose, organization }: Props) {
  const { t } = useTranslation("organization")
  const dispatch = useAppDispatch()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: { name: organization.name },
  })

  useEffect(() => {
    if (open) reset({ name: organization.name })
  }, [open, organization.name, reset])

  const onSubmit = async ({ name }: FormValues) => {
    await dispatch(
      updateOrganization({ organizationId: organization.id, name, onSuccess: onClose }),
    ).unwrap()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("editDialog.title")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <Label htmlFor="org-name">{t("props.name")}</Label>
          <Input
            id="org-name"
            placeholder={t("editDialog.namePlaceholder")}
            autoFocus
            {...register("name")}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("editDialog.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "…" : t("editDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
