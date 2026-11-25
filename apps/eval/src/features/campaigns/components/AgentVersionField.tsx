import type { AgentParamsDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { type Control, Controller } from "react-hook-form"
import { AgentVersionPicker } from "@/components/shared/AgentVersionPicker"
import { agentVersionsQueryOptions } from "@/features/agents"
import type { CampaignFormValues } from "../schemas"

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
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  return (
    <Controller
      control={control}
      name="agentSettingsId"
      render={({ field, fieldState }) => (
        <AgentVersionPicker
          versions={versions}
          agentName={agentName}
          selectedId={field.value}
          onSelect={field.onChange}
          isLocked={isLocked}
          description={
            <Trans>
              Testers chat with this version and reviewers read it, for the whole campaign.
            </Trans>
          }
          selectedNote={<Trans>The campaign runs on this version</Trans>}
          error={
            fieldState.invalid ? <Trans>Choose the version the campaign runs on.</Trans> : undefined
          }
        />
      )}
    />
  )
}
