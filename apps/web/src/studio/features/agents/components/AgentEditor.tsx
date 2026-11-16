import { Button } from "@caseai-connect/ui/shad/button"
import { ButtonGroup } from "@caseai-connect/ui/shad/button-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { AlertTriangleIcon, CodeXmlIcon, type LucideIcon, NetworkIcon } from "lucide-react"
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
import { AgentEditorSaveStatus } from "../agent-settings/components/AgentEditorSaveStatus"
import { AgentSettingsCreateButton } from "../agent-settings/components/AgentSettingsCreateButton"
import { AgentSettingsHistory } from "../agent-settings/components/AgentSettingsHistory"
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
 * Only the active tab is mounted. Before the editor switches tab or lets the user navigate
 * away, it saves what waits in the active tab. It prompts with a ConfirmDialog only for changes
 * that cannot be saved (an invalid value, a failed save) or for an open sheet with unsaved
 * changes.
 */
export function AgentEditor({
  agent,
  agentSettings,
  className,
  orchestration,
  defaultTab,
  onDirtyChange,
  showVersionActions = false,
}: {
  agent: Agent
  agentSettings: AgentSettings
  className?: string
  orchestration?: AgentEditorOrchestration
  /**
   * Which tab to open on (defaults to "general"), or which sheet to open over it. Deep links
   * pass the `?tab=` param through.
   */
  defaultTab?: TabKey
  /** Reports whether the active tab holds changes the draft does not have yet, e.g. to disable a publish action. */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * Shows the History and Save version buttons next to the tabs. For a page whose header has no
   * such buttons, like the extraction agent page that embeds the editor.
   */
  showVersionActions?: boolean
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
        autosave: true,
        render: ({ saveControl }) => (
          <GeneralTab agent={agent} agentSettings={agentSettings} saveControl={saveControl} />
        ),
      },
      {
        value: "model",
        label: t("agentSettings:tabs.model"),
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
        autosave: true,
        render: ({ saveControl }) => (
          <ToolsTab agentSettings={agentSettings} saveControl={saveControl} />
        ),
      })

      if (project.agentSessionCategories.length > 0) {
        list.push({
          value: "categories",
          label: t("agentSettings:tabs.categories"),
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
  const [saveState, setSaveState] = useState<TabSaveState>("saved")
  // The active tab puts here how to save now what waits for its pause.
  const flushRef = useRef<(() => void) | null>(null)
  // A restore replaces the settings under the forms: they reload on it.
  const restoreCount = useAppSelector(selectAgentSettingsRestoreCount)

  const handleSaveStateChange = useCallback(
    (next: TabSaveState) => {
      setSaveState(next)
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

  return (
    <div className={className}>
      <Tabs value={nav.active} onValueChange={requestTabChange}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {/* Not tabs: these settings are outside the draft and open in their own sheet. */}
            {sheets.map((sheet) => (
              <Button
                key={sheet.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNav((prev) => ({ ...prev, sheet: sheet.value }))}
              >
                <sheet.icon className="size-4" />
                {sheet.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {activeTab.autosave && (
              <AgentEditorSaveStatus
                state={saveState}
                hasDraft={agentSettings.isDraft}
                onRetry={() => flushRef.current?.()}
              />
            )}
            {showVersionActions && (
              <ButtonGroup>
                <AgentSettingsHistory agent={agent} agentSettings={agentSettings} />
                <AgentSettingsCreateButton
                  agentSettings={agentSettings}
                  hasUnsavedChanges={saveState !== "saved"}
                />
              </ButtonGroup>
            )}
          </div>
        </div>
        {/* Also keyed on the restore count so the active tab form reloads fresh defaults after a
            version is restored from the history sheet. The key must not follow the settings
            themselves (revision, updatedAt): each automatic save changes them, and a reload
            would take the focus away from the field the user is typing in. */}
        <TabsContent
          key={`${activeTab.value}-${restoreCount}`}
          value={activeTab.value}
          className="mt-4"
        >
          {activeTab.render({
            saveControl: { onStateChange: handleSaveStateChange, flushRef },
            openTab: requestTabChange,
          })}
        </TabsContent>
      </Tabs>

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
    </div>
  )
}
