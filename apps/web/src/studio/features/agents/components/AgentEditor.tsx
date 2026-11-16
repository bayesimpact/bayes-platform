import { ButtonGroup } from "@caseai-connect/ui/shad/button-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { AlertTriangleIcon } from "lucide-react"
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
import { EmbedTab } from "@/studio/features/agents/agent-settings/components/tabs/EmbedTab"
import { selectMcpServersData } from "@/studio/features/mcp-servers/mcp-servers.selectors"
import { AgentEditorSaveStatus } from "../agent-settings/components/AgentEditorSaveStatus"
import { AgentSettingsCreateButton } from "../agent-settings/components/AgentSettingsCreateButton"
import { AgentSettingsHistory } from "../agent-settings/components/AgentSettingsHistory"
import type { TabSaveState } from "../agent-settings/components/agent-tab-autosave"
import type { TabSaveControl } from "../agent-settings/components/agent-tab-form.shared"
import { GeneralTab } from "../agent-settings/components/tabs/GeneralTab"
import { McpServersTab } from "../agent-settings/components/tabs/McpServersTab"
import { ModelTab } from "../agent-settings/components/tabs/ModelTab"
import { OrchestrationTab } from "../agent-settings/components/tabs/OrchestrationTab"
import { OutputTab } from "../agent-settings/components/tabs/OutputTab"
import { SessionCategoriesTab } from "../agent-settings/components/tabs/SessionCategoriesTab"
import { SourcesTab } from "../agent-settings/components/tabs/SourcesTab"
import { ToolsTab } from "../agent-settings/components/tabs/ToolsTab"

export type AgentEditorOrchestration = {
  agents: Agent[]
  subAgents: AgentSubAgent[]
}

export const agentEditorTabKeys = [
  "general",
  "model",
  "output",
  "sources",
  "tools",
  "categories",
  "orchestration",
  "mcpServers",
  "embed",
] as const
export type TabKey = (typeof agentEditorTabKeys)[number]

type TabContext = {
  /** For a tab that saves by itself. */
  saveControl: TabSaveControl
  /** For a tab that saves with a button. */
  onDirtyChange: (dirty: boolean) => void
  /** Switches tab, once the current one is saved. */
  openTab: (tab: TabKey) => void
}
type TabConfig = {
  value: TabKey
  label: string
  /** The tab writes to the draft and saves by itself: the editor shows the state of its save. */
  autosave?: boolean
  render: (context: TabContext) => ReactNode
}

/**
 * Agent editor. Each tab is a self-contained form that owns its own save (see the per-tab
 * components). The tabs that write to the draft save by themselves, a short pause after each
 * change. The tabs whose changes go live at once (orchestration, embed) keep a Save button.
 *
 * Only the active tab is mounted. Before the editor switches tab or lets the user navigate
 * away, it saves what waits in the active tab. It prompts with a ConfirmDialog only for changes
 * that cannot be saved: an invalid value, a failed save, or a tab with a Save button.
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
  /** Which tab to open on (defaults to "general"). Deep links pass the `?tab=` param through. */
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

  const tabs = useMemo<TabConfig[]>(() => {
    const isConversation = agent.type === "conversation"
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
        list.push({
          value: "orchestration",
          label: t("agentSettings:tabs.orchestration"),
          render: ({ onDirtyChange }) => (
            <OrchestrationTab
              agent={agent}
              availableAgents={orchestration.agents}
              subAgents={orchestration.subAgents}
              onDirtyChange={onDirtyChange}
            />
          ),
        })
      }

      if (hasFeature("agent-embed")) {
        list.push({
          value: "embed",
          label: t("agentSettings:tabs.embed"),
          render: ({ onDirtyChange }) => <EmbedTab onDirtyChange={onDirtyChange} />,
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

    return list
  }, [agent, agentSettings, project, hasFeature, orchestration, projectMcpServers, t])

  const [nav, setNav] = useState<{ active: TabKey; pending: TabKey | null }>({
    active: defaultTab ?? "general",
    pending: null,
  })
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
  const handleDirtyChange = useCallback(
    (dirty: boolean) => handleSaveStateChange(dirty ? "unsaved" : "saved"),
    [handleSaveStateChange],
  )

  // Browser-level leave (refresh / close tab); in-app navigation is handled by the blocker below.
  usePreventLeave(saveState !== "saved")
  const blocker = useBlocker(saveState !== "saved")
  const isLeavingEditor = blocker.state === "blocked"
  const isLeaving = nav.pending !== null || isLeavingEditor

  // The user asked to leave the tab while it held changes. Save them now, then let the user go.
  // Changes that cannot be saved stay: the dialog below asks whether to drop them.
  useEffect(() => {
    if (!isLeaving) return
    if (saveState === "saving") {
      flushRef.current?.()
      return
    }
    if (saveState === "unsaved") return
    if (nav.pending) setNav({ active: nav.pending, pending: null })
    else blocker.proceed?.()
  }, [isLeaving, saveState, nav.pending, blocker])

  const activeTab = tabs.find((tab) => tab.value === nav.active) ?? tabs[0]

  if (!activeTab) return <ErrorRoute error="Tab not found" />

  const requestTabChange = (next: string) => {
    if (next === nav.active) return
    if (saveState === "saved") {
      setNav({ active: next as TabKey, pending: null })
    } else {
      setNav((prev) => ({ ...prev, pending: next as TabKey }))
    }
  }

  const handleConfirm = () => {
    if (nav.pending) {
      setNav({ active: nav.pending, pending: null })
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
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
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
            onDirtyChange: handleDirtyChange,
            openTab: requestTabChange,
          })}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={isLeaving && saveState === "unsaved"}
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
