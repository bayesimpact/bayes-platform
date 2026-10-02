import { ButtonGroup } from "@caseai-connect/ui/shad/button-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { AlertTriangleIcon } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useBlocker } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { usePreventLeave } from "@/common/hooks/use-prevent-leave"
import { useValue } from "@/common/hooks/use-value"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import type { AgentSubAgent } from "@/studio/features/agent-sub-agents/agent-sub-agents.models"
import { EmbedTab } from "@/studio/features/agents/agent-settings/components/tabs/EmbedTab"
import { selectMcpServersData } from "@/studio/features/mcp-servers/mcp-servers.selectors"
import { AgentSettingsCreateButton } from "../agent-settings/components/AgentSettingsCreateButton"
import { AgentSettingsHistory } from "../agent-settings/components/AgentSettingsHistory"
import { GeneralTab } from "../agent-settings/components/tabs/GeneralTab"
import { McpServersTab } from "../agent-settings/components/tabs/McpServersTab"
import { ModelTab } from "../agent-settings/components/tabs/ModelTab"
import { OrchestrationTab } from "../agent-settings/components/tabs/OrchestrationTab"
import { OutputTab } from "../agent-settings/components/tabs/OutputTab"
import { ResourceLibrariesTab } from "../agent-settings/components/tabs/ResourceLibrariesTab"
import { SessionCategoriesTab } from "../agent-settings/components/tabs/SessionCategoriesTab"
import { SourcesTab } from "../agent-settings/components/tabs/SourcesTab"
import { ToolsTab } from "../agent-settings/components/tabs/ToolsTab"

export type AgentEditorOrchestration = {
  agents: Agent[]
  subAgents: AgentSubAgent[]
}

type TabKey =
  | "general"
  | "model"
  | "output"
  | "sources"
  | "resourceLibraries"
  | "tools"
  | "categories"
  | "orchestration"
  | "mcpServers"
  | "embed"

type DirtyHandler = (dirty: boolean) => void
type TabConfig = {
  value: TabKey
  label: string
  render: (onDirtyChange: DirtyHandler) => ReactNode
}

/**
 * Agent editor. Each tab is a self-contained form that owns its own save (see the per-tab
 * components). Only the active tab is mounted, so leaving a tab discards its edits; we prompt
 * with a ConfirmDialog before switching tabs or navigating away while a tab has unsaved changes.
 */
export function AgentEditor({
  agent,
  agentSettings,
  className,
  orchestration,
  onDirtyChange,
}: {
  agent: Agent
  agentSettings: AgentSettings
  className?: string
  orchestration?: AgentEditorOrchestration
  /** Reports whether the active tab has unsaved changes, e.g. to disable a publish action. */
  onDirtyChange?: (dirty: boolean) => void
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
        render: (onDirtyChange) => (
          <GeneralTab agent={agent} agentSettings={agentSettings} onDirtyChange={onDirtyChange} />
        ),
      },
      {
        value: "model",
        label: t("agentSettings:tabs.model"),
        render: (onDirtyChange) => (
          <ModelTab agentSettings={agentSettings} onDirtyChange={onDirtyChange} />
        ),
      },
    ]

    // For conversation agents, we show the sources, resource libraries, and categories tabs
    if (isConversation) {
      list.push({
        value: "sources",
        label: t("agentSettings:tabs.sources"),
        render: (onDirtyChange) => (
          <SourcesTab agentSettings={agentSettings} onDirtyChange={onDirtyChange} />
        ),
      })

      list.push({
        value: "resourceLibraries",
        label: t("agentSettings:tabs.resourceLibraries"),
        render: (onDirtyChange) => (
          <ResourceLibrariesTab agentSettings={agentSettings} onDirtyChange={onDirtyChange} />
        ),
      })

      list.push({
        value: "tools",
        label: t("agentSettings:tabs.tools"),
        render: (onDirtyChange) => (
          <ToolsTab agentSettings={agentSettings} onDirtyChange={onDirtyChange} />
        ),
      })

      if (project.agentSessionCategories.length > 0) {
        list.push({
          value: "categories",
          label: t("agentSettings:tabs.categories"),
          render: (onDirtyChange) => (
            <SessionCategoriesTab agentSettings={agentSettings} onDirtyChange={onDirtyChange} />
          ),
        })
      }

      if (hasFeature("agent-orchestration") && orchestration) {
        list.push({
          value: "orchestration",
          label: t("agentSettings:tabs.orchestration"),
          render: (onDirtyChange) => (
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
          render: (onDirtyChange) => <EmbedTab onDirtyChange={onDirtyChange} />,
        })
      }
    }
    // For extraction agents, we only show the output tab
    else {
      list.push({
        value: "output",
        label: t("agentSettings:tabs.output"),
        render: (onDirtyChange) => (
          <OutputTab agentSettings={agentSettings} onDirtyChange={onDirtyChange} />
        ),
      })
    }

    // Some built-in servers only fit one agent type, e.g. PDF export needs a chat answer
    const agentTypeMcpServers = projectMcpServers.filter((server) =>
      server.agentTypes.includes(agent.type),
    )
    if (hasFeature("agent-mcp") && agentTypeMcpServers.length > 0) {
      list.push({
        value: "mcpServers",
        label: t("agentSettings:tabs.mcpServers"),
        render: () => (
          <McpServersTab
            agentId={agent.id}
            agentMcpServers={agentSettings.mcpServers}
            projectMcpServers={agentTypeMcpServers}
          />
        ),
      })
    }

    return list
  }, [agent, agentSettings, project, hasFeature, orchestration, projectMcpServers, t])

  const [nav, setNav] = useState<{ active: TabKey; pending: TabKey | null }>({
    active: "general",
    pending: null,
  })
  const [dirty, setDirty] = useState(false)

  const handleDirtyChange = (next: boolean) => {
    setDirty(next)
    onDirtyChange?.(next)
  }

  // Browser-level leave (refresh / close tab); in-app navigation is handled by the blocker below.
  usePreventLeave(dirty)
  const blocker = useBlocker(dirty)
  const isLeavingEditor = blocker.state === "blocked"

  const activeTab = tabs.find((tab) => tab.value === nav.active) ?? tabs[0]

  if (!activeTab) return <ErrorRoute error="Tab not found" />

  const requestTabChange = (next: string) => {
    if (next === nav.active) return
    if (dirty) {
      setNav((prev) => ({ ...prev, pending: next as TabKey }))
    } else {
      setNav({ active: next as TabKey, pending: null })
    }
  }

  const handleConfirm = () => {
    if (nav.pending) {
      setNav({ active: nav.pending, pending: null })
      handleDirtyChange(false)
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
          {agent.type === "extraction" && (
            <ButtonGroup>
              <AgentSettingsHistory agent={agent} agentSettings={agentSettings} />
              <AgentSettingsCreateButton agentSettings={agentSettings} hasUnsavedChanges={dirty} />
            </ButtonGroup>
          )}
        </div>
        {/* Also keyed on the revision and updatedAt so the active tab form reloads fresh defaults
            after a version is restored from the history sheet. Restoring over an existing draft
            keeps the same revision (the draft is overwritten in place), so revision alone is not
            enough to detect it. */}
        <TabsContent
          key={`${activeTab.value}-${agentSettings.revision}-${agentSettings.updatedAt}`}
          value={activeTab.value}
          className="mt-4"
        >
          {activeTab.render(handleDirtyChange)}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={nav.pending !== null || isLeavingEditor}
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
