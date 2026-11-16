import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import {
  AlertTriangleIcon,
  BracesIcon,
  CodeXmlIcon,
  CpuIcon,
  LibraryBigIcon,
  type LucideIcon,
  NetworkIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  TagsIcon,
  WrenchIcon,
} from "lucide-react"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useBlocker } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { selectAgentSettingsRestoreCount } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { usePreventLeave } from "@/common/hooks/use-prevent-leave"
import { useValue } from "@/common/hooks/use-value"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { useAppSelector } from "@/common/store/hooks"
import type { AgentSubAgent } from "@/studio/features/agent-sub-agents/agent-sub-agents.models"
import { EmbedSheet } from "@/studio/features/agents/agent-settings/components/sheets/EmbedSheet"
import { selectMcpServersData } from "@/studio/features/mcp-servers/mcp-servers.selectors"
import type { TabSaveState } from "../agent-settings/components/agent-tab-autosave"
import type { TabSaveControl } from "../agent-settings/components/agent-tab-form.shared"
import { OrchestrationSheet } from "../agent-settings/components/sheets/OrchestrationSheet"
import { GeneralTab } from "../agent-settings/components/tabs/GeneralTab"
import { McpServersTab } from "../agent-settings/components/tabs/McpServersTab"
import { ModelTab } from "../agent-settings/components/tabs/ModelTab"
import { OutputTab } from "../agent-settings/components/tabs/OutputTab"
import { SessionCategoriesTab } from "../agent-settings/components/tabs/SessionCategoriesTab"
import { SourcesTab } from "../agent-settings/components/tabs/SourcesTab"
import { ToolsTab } from "../agent-settings/components/tabs/ToolsTab"
import { AgentEditorPageView } from "./AgentEditorPageView"

export type AgentEditorOrchestration = {
  agents: Agent[]
  subAgents: AgentSubAgent[]
}

const tabKeys = [
  "general",
  "model",
  "output",
  "sources",
  "tools",
  "categories",
  "mcpServers",
] as const
/** The settings outside the draft: each opens in a full-page sheet with its own Save. */
const sheetKeys = ["orchestration", "embed"] as const
/** What a `?tab=` deep link can open: a tab, or one of the sheets. */
export const agentEditorTabKeys = [...tabKeys, ...sheetKeys] as const
export type TabKey = (typeof agentEditorTabKeys)[number]
type EditorTabKey = (typeof tabKeys)[number]
type SheetKey = (typeof sheetKeys)[number]

const isSheetKey = (key: TabKey | undefined): key is SheetKey => sheetKeys.includes(key as SheetKey)

type TabContext = {
  saveControl: TabSaveControl
  /** Switches tab, once the current one is saved. */
  openTab: (tab: EditorTabKey) => void
}
type TabConfig = {
  value: EditorTabKey
  label: string
  icon: LucideIcon
  /** The tab writes to the draft and saves by itself: the editor shows the state of its save. */
  autosave?: boolean
  render: (context: TabContext) => ReactNode
}
type SheetContext = {
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
}
type SheetConfig = {
  value: SheetKey
  label: string
  icon: LucideIcon
  render: (context: SheetContext) => ReactNode
}

/**
 * Agent editor. Each tab is a self-contained form that owns its own save (see the per-tab
 * components). The tabs write to the draft and save by themselves, a short pause after each
 * change. The settings that are not part of the draft (orchestration, embed) go live when they
 * are saved: they sit apart from the tabs, behind a button that opens a full-page sheet with
 * its own Save.
 *
 * It is a page of its own, outside the Studio layout, with its sections in a sidebar
 * (`AgentEditorPageView`), for conversation and extraction agents alike.
 *
 * Only the active tab is mounted. Before the editor switches tab or lets the user navigate
 * away, it saves what waits in the active tab. It prompts with a ConfirmDialog only for changes
 * that cannot be saved (an invalid value, a failed save) or for an open sheet with unsaved
 * changes.
 */
export function AgentEditor({
  agent,
  agentSettings,
  orchestration,
  defaultTab,
  onDirtyChange,
  onBack,
  banner,
}: {
  agent: Agent
  agentSettings: AgentSettings
  /** Leaves the editor. */
  onBack?: () => void
  /** Shown above the active section. */
  banner?: ReactNode
  orchestration?: AgentEditorOrchestration
  /**
   * Which tab to open on (defaults to "general"), or which sheet to open over it. Deep links
   * pass the `?tab=` param through.
   */
  defaultTab?: TabKey
  /** Reports whether the active tab holds changes the draft does not have yet, e.g. to disable a publish action. */
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const projectMcpServers = useValue(selectMcpServersData)

  const { tabs, sheets } = useMemo<{ tabs: TabConfig[]; sheets: SheetConfig[] }>(() => {
    const isConversation = agent.type === "conversation"
    const sheets: SheetConfig[] = []
    const list: TabConfig[] = [
      {
        value: "general",
        label: t("agentSettings:tabs.general"),
        icon: SlidersHorizontalIcon,
        autosave: true,
        render: ({ saveControl }) => (
          <GeneralTab agent={agent} agentSettings={agentSettings} saveControl={saveControl} />
        ),
      },
      {
        value: "model",
        label: t("agentSettings:tabs.model"),
        icon: CpuIcon,
        autosave: true,
        render: ({ saveControl, openTab }) => (
          <ModelTab
            agentSettings={agentSettings}
            saveControl={saveControl}
            onOpenSourcesTab={isConversation ? () => openTab("sources") : undefined}
          />
        ),
      },
    ]

    // For conversation agents, we show the sources (documents and resource libraries) and
    // categories tabs
    if (isConversation) {
      list.push({
        value: "sources",
        label: t("agentSettings:tabs.sources"),
        icon: LibraryBigIcon,
        autosave: true,
        render: ({ saveControl, openTab }) => (
          <SourcesTab
            agentSettings={agentSettings}
            saveControl={saveControl}
            onOpenModelTab={() => openTab("model")}
          />
        ),
      })

      list.push({
        value: "tools",
        label: t("agentSettings:tabs.tools"),
        icon: WrenchIcon,
        autosave: true,
        render: ({ saveControl }) => (
          <ToolsTab agentSettings={agentSettings} saveControl={saveControl} />
        ),
      })

      if (project.agentSessionCategories.length > 0) {
        list.push({
          value: "categories",
          label: t("agentSettings:tabs.categories"),
          icon: TagsIcon,
          autosave: true,
          render: ({ saveControl }) => (
            <SessionCategoriesTab agentSettings={agentSettings} saveControl={saveControl} />
          ),
        })
      }

      if (hasFeature("agent-orchestration") && orchestration) {
        sheets.push({
          value: "orchestration",
          label: t("agentSettings:tabs.orchestration"),
          icon: NetworkIcon,
          render: ({ onDirtyChange, onClose }) => (
            <OrchestrationSheet
              agent={agent}
              availableAgents={orchestration.agents}
              subAgents={orchestration.subAgents}
              onDirtyChange={onDirtyChange}
              onClose={onClose}
            />
          ),
        })
      }

      if (hasFeature("agent-embed")) {
        sheets.push({
          value: "embed",
          label: t("agentSettings:tabs.embed"),
          icon: CodeXmlIcon,
          render: ({ onDirtyChange, onClose }) => (
            <EmbedSheet onDirtyChange={onDirtyChange} onClose={onClose} />
          ),
        })
      }
    }
    // For extraction agents, we only show the output tab
    else {
      list.push({
        value: "output",
        label: t("agentSettings:tabs.output"),
        icon: BracesIcon,
        autosave: true,
        render: ({ saveControl }) => (
          <OutputTab agentSettings={agentSettings} saveControl={saveControl} />
        ),
      })
    }

    // Built-in servers (PDF export) attach output to a chat reply, which extraction runs do not have
    const availableMcpServers = isConversation
      ? projectMcpServers
      : projectMcpServers.filter((mcpServer) => !mcpServer.isBuiltIn)
    if (hasFeature("agent-mcp") && availableMcpServers.length > 0) {
      list.push({
        value: "mcpServers",
        label: t("agentSettings:tabs.mcpServers"),
        icon: ServerIcon,
        render: () => (
          <McpServersTab
            agentId={agent.id}
            agentMcpServers={agentSettings.mcpServers}
            mcpServers={availableMcpServers}
          />
        ),
      })
    }

    return { tabs: list, sheets }
  }, [agent, agentSettings, project, hasFeature, orchestration, projectMcpServers, t])

  const [nav, setNav] = useState<{
    active: EditorTabKey
    pending: EditorTabKey | null
    /** The open sheet, and whether it holds changes the user did not save. */
    sheet: SheetKey | null
    sheetDirty: boolean
  }>(() =>
    isSheetKey(defaultTab)
      ? { active: "general", pending: null, sheet: defaultTab, sheetDirty: false }
      : { active: defaultTab ?? "general", pending: null, sheet: null, sheetDirty: false },
  )
  const [save, setSave] = useState<{ state: TabSaveState; reason?: string }>({ state: "saved" })
  const saveState = save.state
  // The active tab puts here how to save now what waits for its pause.
  const flushRef = useRef<(() => void) | null>(null)
  // A restore replaces the settings under the forms: they reload on it.
  const restoreCount = useAppSelector(selectAgentSettingsRestoreCount)

  const handleSaveStateChange = useCallback(
    (next: TabSaveState, reason?: string) => {
      setSave({ state: next, reason })
      onDirtyChange?.(next !== "saved")
    },
    [onDirtyChange],
  )
  const handleSheetDirtyChange = useCallback(
    (dirty: boolean) =>
      setNav((prev) => (prev.sheetDirty === dirty ? prev : { ...prev, sheetDirty: dirty })),
    [],
  )
  const closeSheet = useCallback(
    () => setNav((prev) => ({ ...prev, sheet: null, sheetDirty: false })),
    [],
  )

  // Browser-level leave (refresh / close tab); in-app navigation is handled by the blocker below.
  // An open sheet guards its own changes against a browser-level leave.
  usePreventLeave(saveState !== "saved")
  const blocker = useBlocker(saveState !== "saved" || nav.sheetDirty)
  const isLeavingEditor = blocker.state === "blocked"
  const isLeaving = nav.pending !== null || isLeavingEditor
  // Changes that would be lost: the dialog below asks whether to drop them.
  const hasUnsavableChanges = saveState === "unsaved" || nav.sheetDirty

  // The user asked to leave the tab while it held changes. Save them now, then let the user go.
  useEffect(() => {
    if (!isLeaving || hasUnsavableChanges) return
    if (saveState === "saving") {
      flushRef.current?.()
      return
    }
    if (nav.pending)
      setNav((prev) => ({ ...prev, active: nav.pending ?? prev.active, pending: null }))
    else blocker.proceed?.()
  }, [isLeaving, hasUnsavableChanges, saveState, nav.pending, blocker])

  const activeTab = tabs.find((tab) => tab.value === nav.active) ?? tabs[0]

  if (!activeTab) return <ErrorRoute error="Tab not found" />

  const activeSheet = sheets.find((sheet) => sheet.value === nav.sheet)

  const requestTabChange = (next: string) => {
    if (next === nav.active) return
    if (saveState === "saved") {
      setNav((prev) => ({ ...prev, active: next as EditorTabKey, pending: null }))
    } else {
      setNav((prev) => ({ ...prev, pending: next as EditorTabKey }))
    }
  }

  const handleConfirm = () => {
    if (nav.pending) {
      setNav((prev) => ({ ...prev, active: nav.pending ?? prev.active, pending: null }))
      handleSaveStateChange("saved")
    } else if (isLeavingEditor) {
      blocker.proceed?.()
    }
  }

  const handleCancel = () => {
    if (nav.pending) {
      setNav((prev) => ({ ...prev, pending: null }))
    } else if (isLeavingEditor) {
      blocker.reset?.()
    }
  }

  // Also keyed on the restore count so the active tab form reloads fresh defaults after a
  // version is restored from the history sheet. The key must not follow the settings
  // themselves (revision, updatedAt): each automatic save changes them, and a reload would
  // take the focus away from the field the user is typing in.
  const activeSection = (
    <div key={`${activeTab.value}-${restoreCount}`} className="flex flex-col gap-4">
      {/* Why the API refused the save, right above the fields it concerns. */}
      {saveState === "unsaved" && save.reason && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>{t("agentSettings:autosave.refused")}</AlertTitle>
          <AlertDescription>{save.reason}</AlertDescription>
        </Alert>
      )}
      {activeTab.render({
        saveControl: { onStateChange: handleSaveStateChange, flushRef },
        openTab: requestTabChange,
      })}
    </div>
  )
  const viewProps = {
    agent,
    agentSettings,
    sections: tabs,
    sheets,
    activeSection: activeTab.value,
    onSelectSection: requestTabChange,
    onOpenSheet: (value: string) => setNav((prev) => ({ ...prev, sheet: value as SheetKey })),
    saveState,
    onRetrySave: () => flushRef.current?.(),
  }

  return (
    <>
      <AgentEditorPageView {...viewProps} onBack={() => onBack?.()} banner={banner}>
        {activeSection}
      </AgentEditorPageView>

      {activeSheet?.render({ onDirtyChange: handleSheetDirtyChange, onClose: closeSheet })}

      <ConfirmDialog
        open={isLeaving && hasUnsavableChanges}
        title={t("agentSettings:unsavedChanges.title")}
        description={t("agentSettings:unsavedChanges.description")}
        confirmLabel={t("actions:discard")}
        confirmIcon={<AlertTriangleIcon className="size-5" />}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}
