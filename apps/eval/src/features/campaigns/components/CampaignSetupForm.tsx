import { Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import type { CampaignFormValues } from "../schemas"
import { CampaignGeneralFields } from "./CampaignGeneralFields"
import { QuestionListEditor } from "./QuestionListEditor"

export type CampaignSetupFormProps = {
  form: UseFormReturn<CampaignFormValues>
  /** The agent the campaign reviews, which a campaign keeps for good. */
  agentName: string
  /** Only a draft can change: an active or closed campaign shows its setup as it is. */
  isLocked: boolean
  submitLabel: ReactNode
  isPending: boolean
  onSubmit: (values: CampaignFormValues) => void
}

/** The setup of a campaign: its name, what it is for, and its three lists of questions. */
export function CampaignSetupForm({
  form,
  agentName,
  isLocked,
  submitLabel,
  isPending,
  onSubmit,
}: CampaignSetupFormProps) {
  const handleSubmit = form.handleSubmit(onSubmit)
  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-6" noValidate>
      <CampaignGeneralFields form={form} agentName={agentName} isLocked={isLocked} />
      <QuestionListEditor
        control={form.control}
        list="testerPerSessionQuestions"
        title={<Trans>After each session</Trans>}
        description={<Trans>Asked each time a tester ends a session with the agent.</Trans>}
        hasFactual
        disabled={isLocked}
      />
      <QuestionListEditor
        control={form.control}
        list="testerEndOfPhaseQuestions"
        title={<Trans>Final survey</Trans>}
        description={<Trans>Asked once, when a tester finishes taking part.</Trans>}
        disabled={isLocked}
      />
      <QuestionListEditor
        control={form.control}
        list="reviewerQuestions"
        title={<Trans>Session review</Trans>}
        description={<Trans>Asked to a reviewer for each session they review.</Trans>}
        disabled={isLocked}
      />
      {isLocked ? null : (
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}
