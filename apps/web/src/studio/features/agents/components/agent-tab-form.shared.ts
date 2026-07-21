import { useEffect } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"
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

/**
 * Return only the fields the user actually changed. Each tab PATCHes a partial payload, so
 * sending unchanged fields makes the API re-persist them — which can create a spurious
 * agent-settings revision even when the settings did not change (e.g. renaming an agent must
 * not re-write `instructions`/`locale`/`greetingMessage`).
 */
export function pickDirtyFields<TValues extends FieldValues>(
  values: TValues,
  dirtyFields: UseFormReturn<TValues>["formState"]["dirtyFields"],
): Partial<TValues> {
  // The tab forms are flat, so `dirtyFields` is a `{ [field]: boolean }` map.
  const dirtyMap = dirtyFields as Record<string, boolean | undefined>
  const changed: Partial<TValues> = {}
  for (const key of Object.keys(dirtyMap)) {
    if (dirtyMap[key]) changed[key as keyof TValues] = values[key as keyof TValues]
  }
  return changed
}
