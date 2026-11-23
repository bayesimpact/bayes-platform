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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { selectMe } from "@/common/features/me/me.selectors"
import { updateMe } from "@/common/features/me/me.thunks"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { toUiLanguage } from "@/common/utils/get-locale"
import type { SupportedLanguage } from "@/locales/loader"

type FormValues = z.infer<typeof updateMeSchema>

/** Each UI language named in its own language. Missing translations fall back to English. */
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
  it: "Italiano",
  es: "Español",
  pl: "Polski",
}

type Props = {
  open: boolean
  onClose: () => void
}

export function EditProfileDialog({ open, onClose }: Props) {
  const { t, i18n } = useTranslation("user")
  const dispatch = useAppDispatch()
  const user = useValue(selectMe)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(updateMeSchema),
    defaultValues: { name: user.name },
  })

  // The language stays in the browser (the i18next detector keeps it in localStorage), not on the
  // profile, so it is applied on save without going through `updateMe`.
  const currentLanguage = toUiLanguage(i18n.language)
  const [language, setLanguage] = useState(currentLanguage)

  useEffect(() => {
    if (open) {
      reset({ name: user.name })
      setLanguage(currentLanguage)
    }
  }, [open, user.name, reset, currentLanguage])

  const onSubmit = async ({ name }: FormValues) => {
    // Switch first so the "profile updated" toast shows in the chosen language.
    if (language !== i18n.language) await i18n.changeLanguage(language)
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

          <Label htmlFor="profile-language" className="mt-2">
            {t("editProfileDialog.language")}
          </Label>
          <Select value={language} onValueChange={(value) => setLanguage(toUiLanguage(value))}>
            <SelectTrigger id="profile-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                <SelectItem key={code} value={code} lang={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
