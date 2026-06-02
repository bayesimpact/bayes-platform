import { updateMeSchema } from "@caseai-connect/api-contracts"
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
import { selectMe } from "@/common/features/me/me.selectors"
import { updateMe } from "@/common/features/me/me.thunks"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"

type FormValues = z.infer<typeof updateMeSchema>

type Props = {
  open: boolean
  onClose: () => void
}

export function EditProfileDialog({ open, onClose }: Props) {
  const { t } = useTranslation("user")
  const dispatch = useAppDispatch()
  const user = useValue(selectMe)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(updateMeSchema),
    defaultValues: { name: user?.name ?? "" },
  })

  useEffect(() => {
    if (open) reset({ name: user?.name ?? "" })
  }, [open, user?.name, reset])

  const onSubmit = async ({ name }: FormValues) => {
    await dispatch(updateMe({ name })).unwrap()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("editProfileDialog.title")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <Label htmlFor="profile-name">{t("props.name")}</Label>
          <Input
            id="profile-name"
            placeholder={t("editProfileDialog.namePlaceholder")}
            autoFocus
            {...register("name")}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("editProfileDialog.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "…" : t("editProfileDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
