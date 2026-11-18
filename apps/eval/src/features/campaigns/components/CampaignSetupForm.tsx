import { Trans, useLingui } from "@lingui/react/macro"
import { type ReactNode, useId } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CampaignFormValues } from "../schemas"
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
  const { t } = useLingui()
  const nameId = useId()
  const descriptionId = useId()
  const handleSubmit = form.handleSubmit(onSubmit)
  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-6" noValidate>
      <SectionCard
        title={<Trans comment="The general settings of a review campaign">General</Trans>}
        description={<Trans>This campaign reviews the agent {agentName}.</Trans>}
      >
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={nameId}>
                <Trans comment="The name of a review campaign">Name</Trans>
              </FieldLabel>
              <Input
                {...field}
                id={nameId}
                placeholder={t`e.g. Support agent, spring review`}
                aria-invalid={fieldState.invalid}
                disabled={isLocked}
              />
              {fieldState.invalid ? (
                <FieldError>
                  <Trans>Give the campaign a name.</Trans>
                </FieldError>
              ) : null}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="description"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={descriptionId}>
                <Trans>Description</Trans>
              </FieldLabel>
              <Textarea
                {...field}
                id={descriptionId}
                rows={3}
                placeholder={t`What should testers and reviewers evaluate?`}
                disabled={isLocked}
              />
            </Field>
          )}
        />
      </SectionCard>
      <QuestionListEditor
        control={form.control}
        list="testerPerSessionQuestions"
        title={<Trans>Testers, after each session</Trans>}
        description={<Trans>Asked each time a tester ends a session with the agent.</Trans>}
        hasFactual
        disabled={isLocked}
      />
      <QuestionListEditor
        control={form.control}
        list="testerEndOfPhaseQuestions"
        title={<Trans>Testers, at the end</Trans>}
        description={<Trans>Asked once, when a tester finishes taking part.</Trans>}
        disabled={isLocked}
      />
      <QuestionListEditor
        control={form.control}
        list="reviewerQuestions"
        title={<Trans>Reviewers</Trans>}
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
