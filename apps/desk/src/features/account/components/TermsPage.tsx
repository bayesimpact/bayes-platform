import type { MeOutputDto } from "@caseai-connect/desk-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { LogOutIcon } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { DeskLogo } from "@/components/shared/DeskLogo"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth/session"
import { useAcceptTerms } from "../api/mutations"
import { REQUIRED_TERMS_MESSAGE, type TermsFormValues, termsFormSchema } from "../schemas"
import { TermsCheckbox } from "./TermsCheckbox"

export type TermsPageProps = {
  terms: MeOutputDto["currentTerms"]
}

/**
 * Before the Desk opens, the person accepts its terms: the general conditions and the privacy
 * policy, and, if they wish, the AI usage policy. Someone who does not accept can sign out.
 */
export function TermsPage({ terms }: TermsPageProps) {
  const { t, i18n } = useLingui()
  const acceptTerms = useAcceptTerms()
  const { control, handleSubmit, formState } = useForm<TermsFormValues>({
    resolver: zodResolver(termsFormSchema),
    defaultValues: {
      generalConditionsAccepted: false,
      privacyPolicyAccepted: false,
      aiUsagePolicyAccepted: false,
    },
  })
  const [generalConditionsAccepted, privacyPolicyAccepted] = useWatch({
    control,
    name: ["generalConditionsAccepted", "privacyPolicyAccepted"],
  })
  const canSubmit = generalConditionsAccepted && privacyPolicyAccepted && !acceptTerms.isPending
  const hasRequiredError = Boolean(
    formState.errors.generalConditionsAccepted || formState.errors.privacyPolicyAccepted,
  )

  const onSubmit = ({ aiUsagePolicyAccepted }: TermsFormValues) =>
    acceptTerms.mutate(aiUsagePolicyAccepted, {
      onError: () => toast.error(t`Your answer could not be saved. Try again.`),
    })

  const documents = [
    {
      name: "generalConditionsAccepted" as const,
      label: t`I accept the general conditions of service`,
      documentName: t`general conditions of service`,
      isRequired: true,
      document: terms.generalConditions,
    },
    {
      name: "privacyPolicyAccepted" as const,
      label: t`I accept the privacy policy`,
      documentName: t`privacy policy`,
      isRequired: true,
      document: terms.privacyPolicy,
    },
    {
      name: "aiUsagePolicyAccepted" as const,
      label: t`I accept the AI systems usage policy`,
      documentName: t`AI systems usage policy`,
      isRequired: false,
      document: terms.aiUsagePolicy,
    },
  ]

  return (
    <main className="flex min-h-svh items-center justify-center bg-sidebar px-4 py-10">
      <div className="flex w-full max-w-lg flex-col gap-6 duration-300 animate-in fade-in-0 slide-in-from-bottom-2">
        <DeskLogo />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            <Trans>Before you start</Trans>
          </h1>
          <p className="text-sm text-muted-foreground">
            <Trans>Read and accept the terms of the Desk to continue.</Trans>
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col divide-y rounded-2xl border bg-background shadow-sm dark:bg-card">
            <legend className="sr-only">
              <Trans>Terms</Trans>
            </legend>
            {documents.map((entry) => (
              <Controller
                key={entry.name}
                control={control}
                name={entry.name}
                render={({ field }) => (
                  <TermsCheckbox
                    label={entry.label}
                    documentName={entry.documentName}
                    isRequired={entry.isRequired}
                    document={entry.document}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            ))}
          </fieldset>
          {hasRequiredError ? (
            <p role="alert" className="text-sm text-destructive">
              {i18n._(REQUIRED_TERMS_MESSAGE)}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => void signOut()}>
              <LogOutIcon aria-hidden />
              <Trans>Sign out</Trans>
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              <Trans>Accept and continue</Trans>
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
