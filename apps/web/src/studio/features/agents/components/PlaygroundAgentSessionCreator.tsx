import { extractPromptVariables } from "@caseai-connect/api-contracts"
import { useCallback } from "react"
import {
  BaseAgentSessionCreator,
  type BaseAgentSessionCreatorProps,
  type RenderVariablesDialogParams,
} from "@/common/features/agents/agent-sessions/shared/base-agent-session/components/BaseAgentSessionCreator"
import { selectPlaygroundAgentSettings } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { PromptVariablesSessionDialog } from "@/studio/features/agents/prompt-variables/PromptVariablesSessionDialog"

/**
 * The playground's session creator. When the tested settings declare {{variables}} and the
 * feature is on, it asks for their values before creating the session; every other channel
 * creates directly.
 */
export function PlaygroundAgentSessionCreator(props: BaseAgentSessionCreatorProps) {
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const testedAgentSettings = useAppSelector(
    selectPlaygroundAgentSettings({ agentId: props.ids.agentId }),
  )

  const declaredPromptVariables = testedAgentSettings
    ? extractPromptVariables(testedAgentSettings.instructions)
    : []

  const needsVariablesDialog =
    props.agentType === "conversation" &&
    hasFeature("agent-prompt-variables") &&
    declaredPromptVariables.length > 0

  const renderVariablesDialog = useCallback(
    (params: RenderVariablesDialogParams) => (
      <PromptVariablesSessionDialog {...params} agentSettings={testedAgentSettings} />
    ),
    [testedAgentSettings],
  )

  return (
    <BaseAgentSessionCreator
      {...props}
      renderVariablesDialog={needsVariablesDialog ? renderVariablesDialog : undefined}
    />
  )
}
