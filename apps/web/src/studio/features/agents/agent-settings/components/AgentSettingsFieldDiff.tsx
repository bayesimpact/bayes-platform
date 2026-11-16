import { useTranslation } from "react-i18next"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import {
  type AgentSettingsDiffKey,
  agentSettingsDiffFileNames,
  agentSettingsDiffLabelKeys,
  serializeAgentSettingsField,
} from "../../../../../common/features/agents/agent-settings/agent-settings.functions"
import { TextDiff } from "./TextDiff"

/** The DOM id of a field's diff, so the list of changed fields can scroll to it. */
export const agentSettingsFieldDiffId = (fieldKey: AgentSettingsDiffKey) =>
  `agent-settings-diff-${fieldKey}`

/** Diff of a single versioned settings field between two revisions, rendered with @pierre/diffs. */
export function AgentSettingsFieldDiff({
  fieldKey,
  before,
  after,
}: {
  fieldKey: AgentSettingsDiffKey
  before: AgentSettings
  after: AgentSettings
}) {
  const { t } = useTranslation()

  return (
    <section id={agentSettingsFieldDiffId(fieldKey)} className="scroll-mt-4 space-y-2">
      <h4 className="text-base font-semibold">{t(agentSettingsDiffLabelKeys[fieldKey])}</h4>
      <TextDiff
        name={agentSettingsDiffFileNames[fieldKey]}
        before={serializeAgentSettingsField(before, fieldKey)}
        after={serializeAgentSettingsField(after, fieldKey)}
      />
    </section>
  )
}
