import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { Agent } from "@/common/features/agents/agents.models"
import type { TabSaveState } from "../agent-settings/components/agent-tab-autosave"

/** A section of the agent editor, as its navigation shows it. */
export type AgentEditorSection = {
  value: string
  label: string
  icon: LucideIcon
  /** The section writes to the draft and saves by itself. */
  autosave?: boolean
}

/**
 * What a layout of the agent editor needs to draw it. The editor keeps the state (active
 * section, state of the save, open sheet); a layout only places the navigation, the state of
 * the save, the version buttons and the active section.
 */
export type AgentEditorViewProps = {
  agent: Agent
  agentSettings: AgentSettings
  sections: AgentEditorSection[]
  /** The settings outside the draft that open in a full-page sheet. */
  sheets: AgentEditorSection[]
  activeSection: string
  onSelectSection: (value: string) => void
  onOpenSheet: (value: string) => void
  saveState: TabSaveState
  onRetrySave: () => void
  /** The version history, opened from the layout or from a section. */
  isHistoryOpen: boolean
  onHistoryOpenChange: (open: boolean) => void
  /** The active section. */
  children: ReactNode
}
