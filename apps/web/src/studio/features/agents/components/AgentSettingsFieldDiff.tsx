import { parseDiffFromFile } from "@pierre/diffs"
import { FileDiff } from "@pierre/diffs/react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import {
  type AgentSettingsDiffKey,
  agentSettingsDiffFileNames,
  agentSettingsDiffLabelKeys,
  serializeAgentSettingsField,
} from "../agent-history.functions"

/**
 * Settings values are not files: a missing trailing newline is meaningless here, so add one
 * before diffing to keep @pierre/diffs from rendering its "No newline at end of file" row.
 */
function toDiffContents(value: string): string {
  if (value === "" || value.endsWith("\n")) return value
  return `${value}\n`
}

/** Diff of a single versioned settings field between two revisions, rendered with @pierre/diffs. */
export function AgentSettingsFieldDiff({
  fieldKey,
  before,
  after,
}: {
  fieldKey: AgentSettingsDiffKey
  before: Agent
  after: Agent
}) {
  const { t } = useTranslation()

  const fileDiff = useMemo(() => {
    const name = agentSettingsDiffFileNames[fieldKey]
    return parseDiffFromFile(
      { name, contents: toDiffContents(serializeAgentSettingsField(before, fieldKey)) },
      { name, contents: toDiffContents(serializeAgentSettingsField(after, fieldKey)) },
    )
  }, [fieldKey, before, after])

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-medium">{t(agentSettingsDiffLabelKeys[fieldKey])}</h4>
      <div className="overflow-hidden rounded-md border">
        <FileDiff
          fileDiff={fileDiff}
          options={{ diffStyle: "unified", disableFileHeader: true, overflow: "wrap" }}
        />
      </div>
    </section>
  )
}
