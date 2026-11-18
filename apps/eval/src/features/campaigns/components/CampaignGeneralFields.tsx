import { Trans, useLingui } from "@lingui/react/macro"
import { useId } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { SectionCard } from "@/components/shared/SectionCard"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CampaignFormValues } from "../schemas"

export type CampaignGeneralFieldsProps = {
  form: UseFormReturn<CampaignFormValues>
  /** The agent the campaign reviews, which a campaign keeps for good. */
  agentName: string
  isLocked: boolean
}

/** A campaign's name and what it is for, in a card of its own. */
export function CampaignGeneralFields({ form, agentName, isLocked }: CampaignGeneralFieldsProps) {
  const { t } = useLingui()
  const nameId = useId()
  const descriptionId = useId()
  return (
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
  )
}
