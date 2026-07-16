import { Button } from "@caseai-connect/ui/shad/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import { zodResolver } from "@hookform/resolvers/zod"
import { ExternalLinkIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { FullPageCenterLayout } from "@/common/components/layouts/FullPageCenterLayout"
import type { TermsDocument } from "@/common/features/me/me.models"
import { selectCurrentTerms } from "@/common/features/me/me.selectors"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { acceptTerms } from "../features/me/me.thunks"

type TermsFormValues = {
  generalConditionsAccepted: boolean
  privacyPolicyAccepted: boolean
  aiUsagePolicyAccepted: boolean
}

export function TermsRoute() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const currentTerms = useAppSelector(selectCurrentTerms)

  const schema = z.object({
    generalConditionsAccepted: z
      .boolean()
      .refine((value) => value === true, t("termsAcceptance:errors.mandatoryRequired")),
    privacyPolicyAccepted: z
      .boolean()
      .refine((value) => value === true, t("termsAcceptance:errors.mandatoryRequired")),
    aiUsagePolicyAccepted: z.boolean(),
  })

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<TermsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      generalConditionsAccepted: false,
      privacyPolicyAccepted: false,
      aiUsagePolicyAccepted: false,
    },
  })

  if (!currentTerms) return null

  const onSubmit = ({ aiUsagePolicyAccepted }: TermsFormValues) => {
    dispatch(acceptTerms({ aiUsagePolicyAccepted, onSuccess: () => window.location.reload() }))
  }

  const showMandatoryError = !!(errors.generalConditionsAccepted || errors.privacyPolicyAccepted)

  const disabled = !(watch("generalConditionsAccepted") && watch("privacyPolicyAccepted"))

  return (
    <FullPageCenterLayout className="min-h-screen p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{t("termsAcceptance:title")}</CardTitle>
          <CardDescription>{t("termsAcceptance:intro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
            <Controller
              control={control}
              name="generalConditionsAccepted"
              render={({ field }) => (
                <TermsCheckbox
                  id="general-conditions"
                  document={currentTerms.generalConditions}
                  label={t("termsAcceptance:checkboxes.generalConditions")}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="privacyPolicyAccepted"
              render={({ field }) => (
                <TermsCheckbox
                  id="privacy-policy"
                  document={currentTerms.privacyPolicy}
                  label={t("termsAcceptance:checkboxes.privacyPolicy")}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="aiUsagePolicyAccepted"
              render={({ field }) => (
                <TermsCheckbox
                  id="ai-usage-policy"
                  document={currentTerms.aiUsagePolicy}
                  label={t("termsAcceptance:checkboxes.aiUsagePolicy")}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {showMandatoryError && (
              <p className="text-sm text-destructive">
                {t("termsAcceptance:errors.mandatoryRequired")}
              </p>
            )}

            <Button disabled={disabled} type="submit">
              {t("termsAcceptance:submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </FullPageCenterLayout>
  )
}

function TermsCheckbox({
  id,
  document,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  document: TermsDocument
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-1"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium leading-snug cursor-pointer">
          {label}
        </label>
        <a
          href={document.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline w-fit"
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" />
          {t("actions:open")}
        </a>
      </div>
    </div>
  )
}
