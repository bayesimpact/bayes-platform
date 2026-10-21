import { useLingui } from "@lingui/react/macro"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import type { HistoryAgent, HistoryEntry } from "../history-entries"

/**
 * Tells the person when one of their extractions ends while they are on another page, with a way
 * to open it: the history's mark alone is easy to miss. The toast is outside React, which an
 * effect follows.
 */
export function useFinishedRunToasts(agent: HistoryAgent, entries: HistoryEntry[]): void {
  const { t } = useLingui()
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const openId = params.extractionRunId ?? params.csvRunId
  // The states of the last render, `null` until the history first loads.
  const previous = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    const states = new Map(
      entries.flatMap((entry) => (entry.kind === "conversation" ? [] : [[entry.id, entry.state]])),
    )
    const before = previous.current
    previous.current = states
    if (!before) return
    for (const entry of entries) {
      if (entry.kind === "conversation" || entry.state === "pending") continue
      if (before.get(entry.id) !== "pending" || entry.id === openId) continue
      const name =
        entry.fileName ??
        (entry.kind === "csv"
          ? t({ message: "CSV extraction", comment: "An extraction of every row of a spreadsheet" })
          : t`Untitled document`)
      const agentParams = {
        organizationId: agent.organizationId,
        projectId: agent.projectId,
        agentId: agent.agentId,
      }
      const open = () =>
        entry.kind === "csv"
          ? navigate({
              to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId",
              params: { ...agentParams, csvRunId: entry.id },
            })
          : navigate({
              to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/runs/$extractionRunId",
              params: { ...agentParams, extractionRunId: entry.id },
            })
      const action = { label: t`Open`, onClick: () => void open() }
      if (entry.state === "done") toast.success(t`${name} is extracted.`, { action })
      else toast.error(t`The extraction of ${name} failed.`, { action })
    }
  }, [entries, openId, agent, navigate, t])
}
