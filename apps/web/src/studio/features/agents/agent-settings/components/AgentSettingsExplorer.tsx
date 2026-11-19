import { useMemo, useState } from "react"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { selectAgentSettingsHistoryDataByAgentId } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import {
  AgentSettingsCompare,
  type AgentSettingsCompareAvailability,
  type AgentSettingsCompareMode,
} from "./AgentSettingsCompare"
import { AgentSettingsList } from "./AgentSettingsList"

interface AgentVersionComparison {
  /** The version highlighted in the timeline and shown in the diff. */
  selected: AgentSettings
  /** `selected` is the newest version, so there is nothing newer to restore from. */
  isLatest: boolean
  /** The agent has a pending draft, so the "draft" mode is offered as a third comparison. */
  hasDraft: boolean
  /** Which of the three comparisons are possible for `selected`. */
  availability: AgentSettingsCompareAvailability
  /** The requested `mode`, downgraded to whichever comparison is actually possible. */
  effectiveMode: AgentSettingsCompareMode
  /** Older/newer versions fed to the diff, derived from `effectiveMode`. */
  before: AgentSettings
  after: AgentSettings
}

/** Tried in order when the requested mode is not available for the selected version. */
const modeFallbackOrder: AgentSettingsCompareMode[] = ["previous", "current", "draft"]

/**
 * Resolve everything the two panes need from the raw version list plus the current UI state.
 *
 * `versions` is ordered by revision descending, so `versions[0]` is the newest version — the
 * pending draft when there is one — and each following index is one step older. Returns `null`
 * when there is no version to show.
 */
export function buildComparison(
  versions: AgentSettings[],
  selectedRevision: number | null,
  mode: AgentSettingsCompareMode,
): AgentVersionComparison | null {
  const latest = versions[0]
  if (!latest) return null

  // The draft (at most one, always the newest revision) and the production version the agent
  // actually runs with — the two things another revision can be compared against.
  const draft = latest.isDraft ? latest : undefined
  const production = versions.find((version) => version.isProduction)

  // Default selection, until the user picks a revision from the timeline: the pending draft when
  // there is one (its diff against the last published version is what users open the history for),
  // otherwise the previous version (index 1). Clamp when the list has a single entry.
  const defaultIndex = draft ? 0 : Math.min(1, versions.length - 1)
  const requestedIndex = versions.findIndex((version) => version.revision === selectedRevision)
  const selectedIndex = requestedIndex === -1 ? defaultIndex : requestedIndex

  const selected = versions[selectedIndex] ?? latest
  const previous = versions[selectedIndex + 1]

  // The draft target only makes sense when it is strictly newer than the selected version,
  // otherwise the diff would run backwards or against the selection itself. Production can sit
  // below newer saved revisions, so it is compared with any other revision.
  const availability: AgentSettingsCompareAvailability = {
    previous: previous !== undefined,
    current: production !== undefined && selected.revision !== production.revision,
    draft: draft !== undefined && selected.revision < draft.revision,
  }

  const effectiveMode = availability[mode]
    ? mode
    : (modeFallbackOrder.find((candidate) => availability[candidate]) ?? "previous")

  const target = (effectiveMode === "draft" ? draft : production) ?? selected
  // The diff always reads from the older revision to the newer one.
  const [before, after] =
    effectiveMode === "previous"
      ? [previous ?? selected, selected]
      : selected.revision < target.revision
        ? [selected, target]
        : [target, selected]

  return {
    selected,
    isLatest: selected.revision === latest.revision,
    hasDraft: draft !== undefined,
    availability,
    effectiveMode,
    before,
    after,
  }
}

/**
 * Two-pane version explorer: revision timeline on the left, comparison on the right.
 * `initialRevision` preselects a revision — used when the explorer is opened from a
 * revision badge rather than from the editor's versions button.
 */
export function AgentSettingsExplorer({ initialRevision }: { initialRevision?: number }) {
  const agentId = useCurrentId(selectCurrentAgentId)
  const versions = useValue(
    selectAgentSettingsHistoryDataByAgentId({ agentId, includeDraft: true }),
  )
  const [selectedRevision, setSelectedRevision] = useState<number | null>(initialRevision ?? null)
  const [mode, setMode] = useState<AgentSettingsCompareMode>("current")

  const comparison = useMemo(
    () => buildComparison(versions, selectedRevision, mode),
    [versions, selectedRevision, mode],
  )
  if (!comparison) return null

  const { selected, before, after, isLatest, hasDraft, availability, effectiveMode } = comparison

  return (
    <div className="flex min-h-0 flex-1">
      <AgentSettingsList
        versions={versions}
        selectedRevision={selected.revision}
        onSelect={setSelectedRevision}
      />
      <AgentSettingsCompare
        before={before}
        after={after}
        selected={selected}
        isLatest={isLatest}
        hasDraft={hasDraft}
        availability={availability}
        mode={effectiveMode}
        onModeChange={setMode}
      />
    </div>
  )
}
