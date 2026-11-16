import { Button } from "@caseai-connect/ui/shad/button"
import { ButtonGroup } from "@caseai-connect/ui/shad/button-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { AgentEditorSaveStatus } from "../agent-settings/components/AgentEditorSaveStatus"
import { AgentSettingsCreateButton } from "../agent-settings/components/AgentSettingsCreateButton"
import { AgentSettingsHistory } from "../agent-settings/components/AgentSettingsHistory"
import type { AgentEditorViewProps } from "./agent-editor-view.types"

/**
 * The agent editor inside another page: its sections are tabs. For the extraction agent page,
 * which shows the editor under its playground.
 */
export function AgentEditorTabsView({
  agent,
  agentSettings,
  sections,
  sheets,
  activeSection,
  onSelectSection,
  onOpenSheet,
  saveState,
  onRetrySave,
  className,
  showVersionActions,
  children,
}: AgentEditorViewProps & { className?: string; showVersionActions: boolean }) {
  const active = sections.find((section) => section.value === activeSection)

  return (
    <div className={className}>
      <Tabs value={activeSection} onValueChange={onSelectSection}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              {sections.map((section) => (
                <TabsTrigger key={section.value} value={section.value}>
                  {section.label}
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
                onClick={() => onOpenSheet(sheet.value)}
              >
                <sheet.icon className="size-4" />
                {sheet.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {active?.autosave && (
              <AgentEditorSaveStatus
                state={saveState}
                hasDraft={agentSettings.isDraft}
                onRetry={onRetrySave}
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
        <TabsContent value={activeSection} className="mt-4">
          {children}
        </TabsContent>
      </Tabs>
    </div>
  )
}
