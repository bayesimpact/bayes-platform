import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { type Control, Controller } from "react-hook-form"
import type { CampaignFormValues } from "../schemas"
import { AgentVersionPicker } from "./AgentVersionPicker"

export type AgentVersionFieldProps = {
  control: Control<CampaignFormValues>
  agentParams: AgentParamsDto
  agentName: string
}

/**
 * The saved version of the agent the whole campaign runs on: the testers chat with it and the
 * reviewers read it, whatever goes to production meanwhile. The manager picks it in the history
 * of the agent's versions.
 */
export function AgentVersionField({ control, agentParams, agentName }: AgentVersionFieldProps) {
  return (
    <Controller
      control={control}
      name="agentSettingsId"
      render={({ field, fieldState }) => (
        <AgentVersionPicker
          agentParams={agentParams}
          agentName={agentName}
          selectedId={field.value}
          onSelect={field.onChange}
          description={
            <Trans>
              Testers chat with this version and reviewers read it, for the whole campaign.
            </Trans>
          }
          error={
            fieldState.invalid ? <Trans>Choose the version the campaign runs on.</Trans> : undefined
          }
        />
      )}
    />
  )
}
