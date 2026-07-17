import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { AlertTriangleIcon } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useBlocker } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { usePreventLeave } from "@/common/hooks/use-prevent-leave"
import { useValue } from "@/common/hooks/use-value"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { AgentEmbedTab } from "@/studio/features/agent-embed-configs/components/AgentEmbedTab"
import type { AgentSubAgent } from "@/studio/features/agent-sub-agents/agent-sub-agents.models"
import { selectMcpServersData } from "@/studio/features/mcp-servers/mcp-servers.selectors"
import { AgentGeneralTab } from "./AgentGeneralTab"
import { AgentMcpServersTab } from "./AgentMcpServersTab"
import { AgentModelTab } from "./AgentModelTab"
import { AgentOrchestrationTab } from "./AgentOrchestrationTab"
import { AgentOutputTab } from "./AgentOutputTab"
import { AgentResourceLibrariesTab } from "./AgentResourceLibrariesTab"
import { AgentSessionCategoriesTab } from "./AgentSessionCategoriesTab"
import { AgentSourcesTab } from "./AgentSourcesTab"
import { AgentVersionHistory } from "./AgentVersionHistory"

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
  className,
  orchestration,
}: {
  agent: Agent
  className?: string
  orchestration?: AgentEditorOrchestration
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
        label: t("agent:tabs.general"),
        render: (onDirtyChange) => <AgentGeneralTab agent={agent} onDirtyChange={onDirtyChange} />,
      },
      {
        value: "model",
        label: t("agent:tabs.model"),
        render: (onDirtyChange) => <AgentModelTab agent={agent} onDirtyChange={onDirtyChange} />,
      },
    ]

    // For conversation agents, we show the sources, resource libraries, and categories tabs
    if (isConversation) {
      list.push({
        value: "sources",
        label: t("agent:tabs.sources"),
        render: (onDirtyChange) => <AgentSourcesTab agent={agent} onDirtyChange={onDirtyChange} />,
      })

      list.push({
        value: "resourceLibraries",
        label: t("agent:tabs.resourceLibraries"),
        render: (onDirtyChange) => (
          <AgentResourceLibrariesTab agent={agent} onDirtyChange={onDirtyChange} />
        ),
      })

      if (project.agentSessionCategories.length > 0) {
        list.push({
          value: "categories",
          label: t("agent:tabs.categories"),
          render: (onDirtyChange) => (
            <AgentSessionCategoriesTab agent={agent} onDirtyChange={onDirtyChange} />
          ),
        })
      }

      if (hasFeature("agent-orchestration") && orchestration) {
        list.push({
          value: "orchestration",
          label: t("agent:tabs.orchestration"),
          render: (onDirtyChange) => (
            <AgentOrchestrationTab
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
          label: t("agent:tabs.embed"),
          render: (onDirtyChange) => <AgentEmbedTab onDirtyChange={onDirtyChange} />,
        })
      }
    }
    // For non-conversation agents, we only show the output tab
    else {
      list.push({
        value: "output",
        label: agent.type === "form" ? t("agent:tabs.form") : t("agent:tabs.output"),
        render: (onDirtyChange) => <AgentOutputTab agent={agent} onDirtyChange={onDirtyChange} />,
      })
    }

    if (hasFeature("agent-mcp") && projectMcpServers.length > 0) {
      list.push({
        value: "mcpServers",
        label: t("agent:tabs.mcpServers"),
        render: () => <AgentMcpServersTab agentId={agent.id} agentMcpServers={agent.mcpServers} />,
      })
    }

    return list
  }, [agent, project, hasFeature, orchestration, projectMcpServers, t])

  const [nav, setNav] = useState<{ active: TabKey; pending: TabKey | null }>({
    active: "general",
    pending: null,
  })
  const [dirty, setDirty] = useState(false)

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
      setDirty(false)
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
          <AgentVersionHistory agent={agent} />
        </div>
        {/* Also keyed on the revision so the active tab form reloads fresh defaults after a
            version is restored from the history sheet. */}
        <TabsContent
          key={`${activeTab.value}-${agent.revision}`}
          value={activeTab.value}
          className="mt-4"
        >
          {activeTab.render(setDirty)}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={nav.pending !== null || isLeavingEditor}
        title={t("agent:unsavedChanges.title")}
        description={t("agent:unsavedChanges.description")}
        confirmLabel={t("actions:discard")}
        confirmIcon={<AlertTriangleIcon className="size-5" />}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  )
}
