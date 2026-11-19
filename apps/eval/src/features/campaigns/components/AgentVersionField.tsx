import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useId } from "react"
import { type Control, Controller } from "react-hook-form"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { fullDateOf } from "@/lib/format-time"
import { agentVersionsQueryOptions } from "../api/queries"
import type { CampaignFormValues } from "../schemas"
import { AgentVersionTitle } from "./AgentVersionTitle"

export type AgentVersionFieldProps = {
  control: Control<CampaignFormValues>
  agentParams: AgentParamsDto
}

/**
 * The saved versions of the agent, newest first, one of which the whole campaign runs on: the
 * testers chat with it and the reviewers read it, whatever goes to production meanwhile.
 */
export function AgentVersionField({ control, agentParams }: AgentVersionFieldProps) {
  const { i18n } = useLingui()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const baseId = useId()
  return (
    <Controller
      control={control}
      name="agentSettingsId"
      render={({ field, fieldState }) => (
        <FieldSet data-invalid={fieldState.invalid}>
          <FieldLegend variant="label">
            <Trans comment="The saved version of the agent's settings a review campaign runs on">
              Agent version
            </Trans>
          </FieldLegend>
          <FieldDescription>
            <Trans>
              Testers chat with this version and reviewers read it, for the whole campaign.
            </Trans>
          </FieldDescription>
          {versions.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Trans>
                This agent has no saved version yet. Save its settings in the Studio, then come
                back.
              </Trans>
            </p>
          ) : (
            <RadioGroup
              value={field.value}
              onValueChange={(value: string) => field.onChange(value)}
              className="max-h-96 overflow-y-auto p-0.5"
            >
              {versions.map((version) => {
                const itemId = `${baseId}-${version.id}`
                const savedOn = fullDateOf(version.updatedAt, i18n.locale)
                return (
                  <FieldLabel key={version.id} htmlFor={itemId}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>
                          <AgentVersionTitle version={version} />
                        </FieldTitle>
                        <FieldDescription>
                          <Trans>Saved on {savedOn}</Trans>
                          {version.description ? ` · ${version.description}` : null}
                        </FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={version.id} id={itemId} />
                    </Field>
                  </FieldLabel>
                )
              })}
            </RadioGroup>
          )}
          {fieldState.invalid && versions.length > 0 ? (
            <FieldError>
              <Trans>Choose the version the campaign runs on.</Trans>
            </FieldError>
          ) : null}
        </FieldSet>
      )}
    />
  )
}
