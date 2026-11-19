import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useId } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CampaignFormValues } from "../schemas"
import { AgentVersionField } from "./AgentVersionField"

export type CampaignGeneralFieldsProps = {
  form: UseFormReturn<CampaignFormValues>
  /** The agent the campaign reviews, which a campaign keeps for good. */
  agentName: string
  agentParams: AgentParamsDto
  isLocked: boolean
}

/** A campaign's name, what it is for, and the version of its agent it runs on. */
export function CampaignGeneralFields({
  form,
  agentName,
  agentParams,
  isLocked,
}: CampaignGeneralFieldsProps) {
  const { t } = useLingui()
  const nameId = useId()
  const descriptionId = useId()
  return (
    // No frame of its own: the step holds these fields alone, as the other steps hold their list.
    <section className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-semibold">
          <Trans comment="The general settings of a review campaign">General</Trans>
        </h2>
        <p className="text-sm text-muted-foreground">
          <Trans>This campaign reviews the agent {agentName}.</Trans>
        </p>
      </div>
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
      <AgentVersionField control={form.control} agentParams={agentParams} agentName={agentName} />
    </section>
  )
}
