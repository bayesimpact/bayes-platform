import { useEffect } from "react"
import type { Agent } from "@/common/features/agents/agents.models"

/**
 * Each agent editor tab is a self-contained form: its own `useForm`, its own Save button, and
 * its own update thunk. The editor only needs to know whether the active tab has unsaved
 * changes so it can prompt before the tab (or the editor) is left.
 */
export type AgentTabFormProps = {
  agent: Agent
  onDirtyChange: (dirty: boolean) => void
}

/**
 * Report a tab form's dirty state up to the editor, and clear it when the tab unmounts (the
 * editor mounts only the active tab, so leaving a tab unmounts it and discards its edits).
 */
export function useReportDirty(isDirty: boolean, onDirtyChange: (dirty: boolean) => void): void {
  useEffect(() => {
    onDirtyChange(isDirty)
    return () => onDirtyChange(false)
  }, [isDirty, onDirtyChange])
}
