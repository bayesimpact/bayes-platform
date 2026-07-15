import { useState } from "react"
import type { Agent } from "@/common/features/agents/agents.models"
import { AgentVersionCompare, type AgentVersionCompareMode } from "./AgentVersionCompare"
import { AgentVersionList } from "./AgentVersionList"

/**
 * Two-pane version explorer: revision timeline on the left, comparison on the right.
 * `versions` comes from the history endpoint, ordered by revision descending (index 0 is
 * the current version).
 */
export function AgentVersionExplorer({ versions }: { versions: Agent[] }) {
  // Preselect the previous version: that is the one users open the history to inspect.
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null)
  const [mode, setMode] = useState<AgentVersionCompareMode>("current")

  const current = versions[0]
  if (!current) return null

  const effectiveRevision =
    (selectedRevision !== null && versions.some((version) => version.revision === selectedRevision)
      ? selectedRevision
      : null) ??
    versions[1]?.revision ??
    current.revision
  const selectedIndex = versions.findIndex((version) => version.revision === effectiveRevision)
  const selected = versions[selectedIndex] ?? current
  const previous = versions[selectedIndex + 1]

  const isCurrent = selected.revision === current.revision
  const canComparePrevious = previous !== undefined
  const canCompareCurrent = !isCurrent

  // Fall back to whichever comparison is possible when the requested one is not.
  let effectiveMode: AgentVersionCompareMode = mode
  if (mode === "current" && !canCompareCurrent) effectiveMode = "previous"
  if (mode === "previous" && !canComparePrevious) effectiveMode = "current"

  const [before, after] =
    effectiveMode === "current" ? [selected, current] : [previous ?? selected, selected]

  return (
    <div className="flex min-h-0 flex-1">
      <AgentVersionList
        versions={versions}
        selectedRevision={selected.revision}
        onSelect={setSelectedRevision}
      />
      <AgentVersionCompare
        before={before}
        after={after}
        selected={selected}
        isCurrent={isCurrent}
        mode={effectiveMode}
        onModeChange={setMode}
        canComparePrevious={canComparePrevious}
        canCompareCurrent={canCompareCurrent}
      />
    </div>
  )
}
