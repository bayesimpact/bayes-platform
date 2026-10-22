import { useLingui } from "@lingui/react/macro"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { agentParamsOf } from "@/lib/agent-params"
import {
  entryTitleOf,
  type HistoryAgent,
  type HistoryEntry,
  type HistoryEntryState,
} from "../history-entries"

/**
 * Tells the person when one of their extractions ends while they are on another page, with a way
 * to open it: the history's mark alone is easy to miss. The toast is outside React, which an
 * effect follows.
 */
export function useFinishedRunToasts(agent: HistoryAgent, entries: HistoryEntry[]): void {
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const openId = params.extractionRunId ?? params.csvRunId
  // The states of the last render, `null` until the history first loads.
  const previousStatesRef = useRef<Map<string, HistoryEntryState> | null>(null)

  useEffect(() => {
    const states = new Map(
      entries.flatMap((entry) => (entry.kind === "conversation" ? [] : [[entry.id, entry.state]])),
    )
    const previousStates = previousStatesRef.current
    previousStatesRef.current = states
    if (!previousStates) return
    for (const entry of entries) {
      if (entry.kind === "conversation" || entry.state === "pending") continue
      if (previousStates.get(entry.id) !== "pending" || entry.id === openId) continue
      const name = entryTitleOf(entry, i18n)
      const agentParams = agentParamsOf(agent)
      const openEntry = () =>
        entry.kind === "csv"
          ? navigate({
              to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId",
              params: { ...agentParams, csvRunId: entry.id },
            })
          : navigate({
              to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/runs/$extractionRunId",
              params: { ...agentParams, extractionRunId: entry.id },
            })
      const action = {
        label: t({ message: "Open", comment: "Opens the extraction a toast says ended" }),
        onClick: () => void openEntry(),
      }
      if (entry.state === "done") toast.success(t`${name} is extracted.`, { action })
      else toast.error(t`The extraction of ${name} failed.`, { action })
    }
  }, [entries, openId, agent, navigate, t, i18n])
}
