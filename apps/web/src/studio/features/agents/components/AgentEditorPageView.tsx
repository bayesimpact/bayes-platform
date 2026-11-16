import { Button } from "@caseai-connect/ui/shad/button"
import { ButtonGroup } from "@caseai-connect/ui/shad/button-group"
import {
  Sidebar,
  SidebarContent,
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
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { AgentEditorSaveStatus } from "../agent-settings/components/AgentEditorSaveStatus"
import { AgentSettingsCreateButton } from "../agent-settings/components/AgentSettingsCreateButton"
import { AgentSettingsHistory } from "../agent-settings/components/AgentSettingsHistory"
import type { AgentEditorViewProps } from "./agent-editor-view.types"

/**
 * The agent editor as a page of its own: a layout that does not sit in the Studio's. Its
 * sidebar is the editor's menu: first the sections that save by themselves to the draft, then,
 * under "More", the settings outside the draft, which apply when they are saved.
 */
export function AgentEditorPageView({
  agent,
  agentSettings,
  sections,
  sheets,
  activeSection,
  onSelectSection,
  onOpenSheet,
  saveState,
  onRetrySave,
  onBack,
  banner,
  children,
}: AgentEditorViewProps & {
  onBack: () => void
  /** Shown above the active section, a warning about the agent for example. */
  banner?: ReactNode
}) {
  const { t } = useTranslation()
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
            {t("agentSettings:editor.back")}
          </Button>
          <div className="px-2">
            <p className="truncate font-medium">{agent.name}</p>
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

          {liveSections.length + sheets.length > 0 && (
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
                  {sheets.map((sheet) => (
                    <SidebarMenuItem key={sheet.value}>
                      <SidebarMenuButton onClick={() => onOpenSheet(sheet.value)}>
                        <sheet.icon />
                        <span>{sheet.label}</span>
                        {/* It opens over the page, in a full-page sheet. */}
                        <ExternalLinkIcon className="ml-auto text-muted-foreground" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
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
                onRetry={onRetrySave}
              />
            )}
            <ButtonGroup>
              <AgentSettingsHistory agent={agent} agentSettings={agentSettings} />
              <AgentSettingsCreateButton
                agentSettings={agentSettings}
                hasUnsavedChanges={saveState !== "saved"}
              />
            </ButtonGroup>
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
