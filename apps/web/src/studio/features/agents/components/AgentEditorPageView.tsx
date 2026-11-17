import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@caseai-connect/ui/shad/sidebar"
import { ArrowLeftIcon, HistoryIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { AgentEditorSaveStatus } from "../agent-settings/components/AgentEditorSaveStatus"
import { AgentProductionVersionButton } from "../agent-settings/components/AgentProductionVersionButton"
import { AgentSettingsHistorySheet } from "../agent-settings/components/AgentSettingsHistorySheet"
import type { AgentEditorViewProps } from "./agent-editor-view.types"

/**
 * The agent editor as a page of its own: a layout that does not sit in the Studio's. Its
 * sidebar is the editor's menu: first the sections that save by themselves to the draft, then,
 * under "More", the settings outside the draft, which apply when they are saved. Every entry
 * shows in the zone beside the sidebar.
 */
export function AgentEditorPageView({
  agent,
  agentSettings,
  sections,
  activeSection,
  onSelectSection,
  saveState,
  onRetrySave,
  isHistoryOpen,
  onHistoryOpenChange,
  onBack,
  banner,
  children,
}: AgentEditorViewProps & {
  onBack: () => void
  /** Shown above the active section, a warning about the agent for example. */
  banner?: ReactNode
}) {
  const { t } = useTranslation()
  // The same icon as in the Studio sidebar: it tells a conversation agent from an extraction one.
  const AgentTypeIcon = getAgentIcon(agent.type)
  const active = sections.find((section) => section.value === activeSection)
  const draftSections = sections.filter((section) => section.autosave)
  const liveSections = sections.filter((section) => !section.autosave)

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "calc(var(--spacing) * 64)" } as React.CSSProperties}
    >
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="gap-3">
          <Button type="button" variant="ghost" className="justify-start" onClick={onBack}>
            <ArrowLeftIcon />
            {t("actions:back")}
          </Button>
          <div className="px-2">
            <p className="flex items-center gap-2 font-medium">
              <AgentTypeIcon className="size-4 shrink-0" />
              <span className="truncate">{agent.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">{t(`agent:update.${agent.type}.title`)}</p>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {draftSections.map((section) => (
                  <SidebarMenuItem key={section.value}>
                    <SidebarMenuButton
                      isActive={section.value === activeSection}
                      aria-current={section.value === activeSection ? "page" : undefined}
                      onClick={() => onSelectSection(section.value)}
                    >
                      <section.icon />
                      <span>{section.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {liveSections.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("actions:more")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {liveSections.map((section) => (
                    <SidebarMenuItem key={section.value}>
                      <SidebarMenuButton
                        isActive={section.value === activeSection}
                        aria-current={section.value === activeSection ? "page" : undefined}
                        onClick={() => onSelectSection(section.value)}
                      >
                        <section.icon />
                        <span>{section.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* The versions concern the whole agent, not one section: their entry stays in the menu.
            It is a full button, set apart by a line, so it stands out from the menu's entries.
            The version in production sits above it and opens the same history. */}
        <SidebarFooter className="gap-3 border-t p-3">
          <AgentProductionVersionButton
            agent={agent}
            onOpenHistory={() => onHistoryOpenChange(true)}
            className="w-full justify-start"
          />
          <AgentSettingsHistorySheet
            agent={agent}
            open={isHistoryOpen}
            onOpenChange={onHistoryOpenChange}
            trigger={
              <Button type="button" className="w-full">
                <HistoryIcon />
                {t("agentSettings:history.manage")}
              </Button>
            }
          />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background px-4 py-3 lg:px-6">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <h1 className="text-lg font-semibold">{active?.label}</h1>
          <div className="ml-auto flex flex-wrap items-center gap-4">
            {active?.autosave && (
              <AgentEditorSaveStatus
                state={saveState}
                hasDraft={agentSettings.isDraft}
                revision={agentSettings.revision}
                isProduction={agentSettings.isProduction}
                onRetry={onRetrySave}
                onOpenHistory={() => onHistoryOpenChange(true)}
              />
            )}
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
          {banner}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
