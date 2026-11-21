import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { HistoryIcon } from "lucide-react"
import { useState } from "react"
import { type Control, Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldError, FieldLegend, FieldSet } from "@/components/ui/field"
import { fullDateOf } from "@/lib/format-time"
import { agentVersionsQueryOptions } from "../api/queries"
import type { CampaignFormValues } from "../schemas"
import { AgentVersionsSheet } from "./AgentVersionsSheet"
import { AgentVersionTitle } from "./AgentVersionTitle"

export type AgentVersionFieldProps = {
  control: Control<CampaignFormValues>
  agentParams: AgentParamsDto
  agentName: string
  /** Whether the version can no longer change, as the campaign's other fields. */
  isLocked: boolean
}

/**
 * The saved version of the agent the whole campaign runs on: the testers chat with it and the
 * reviewers read it, whatever goes to production meanwhile. The manager picks it in the history
 * of the agent's versions.
 */
export function AgentVersionField({
  control,
  agentParams,
  agentName,
  isLocked,
}: AgentVersionFieldProps) {
  const { i18n } = useLingui()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Controller
      control={control}
      name="agentSettingsId"
      render={({ field, fieldState }) => {
        const selected = versions.find((version) => version.id === field.value)
        const savedOn = selected ? fullDateOf(selected.updatedAt, i18n.locale) : ""
        return (
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              {selected ? (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <AgentVersionTitle version={selected} />
                  <span className="text-sm text-muted-foreground">
                    <Trans>Saved on {savedOn}</Trans>
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  <Trans>No version chosen yet.</Trans>
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(true)}
                disabled={isLocked}
              >
                <HistoryIcon data-icon="inline-start" />
                <Trans>Choose a version</Trans>
              </Button>
              <AgentVersionsSheet
                isOpen={isOpen}
                onOpenChange={setIsOpen}
                agentName={agentName}
                versions={versions}
                selectedId={field.value}
                onSelect={(versionId) => {
                  field.onChange(versionId)
                  setIsOpen(false)
                }}
              />
            </div>
            {fieldState.invalid ? (
              <FieldError>
                <Trans>Choose the version the campaign runs on.</Trans>
              </FieldError>
            ) : null}
          </FieldSet>
        )
      }}
    />
  )
}
