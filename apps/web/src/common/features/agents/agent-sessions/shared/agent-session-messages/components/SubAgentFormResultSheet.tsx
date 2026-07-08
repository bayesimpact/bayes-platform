import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { ClipboardListIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FormResultFields } from "@/common/features/agents/agent-sessions/form/components/FormResultFields"
import type { FormSubSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"

/**
 * Opens a sheet showing the form result of every form sub-agent the parent
 * session delegated to, one tab per sub-agent. Triggered from a delegation tool
 * call; the clicked sub-agent's tab is selected by default.
 */
export function SubAgentFormResultSheet({
  subSessions,
  defaultToolName,
}: {
  subSessions: FormSubSession[]
  defaultToolName: string
}) {
  const { t } = useTranslation()

  if (subSessions.length === 0) return null

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
          <ClipboardListIcon className="size-3.5" />
          {t("formAgentSession:subAgentResults.view")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("formAgentSession:subAgentResults.title")}</SheetTitle>
          <SheetDescription>{t("formAgentSession:subAgentResults.description")}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <Tabs defaultValue={defaultToolName}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start">
              {subSessions.map((subSession) => (
                <TabsTrigger key={subSession.toolName} value={subSession.toolName}>
                  {subSession.agentName}
                </TabsTrigger>
              ))}
            </TabsList>
            {subSessions.map((subSession) => (
              <TabsContent key={subSession.toolName} value={subSession.toolName}>
                <FormResultFields
                  outputJsonSchema={subSession.outputJsonSchema}
                  result={subSession.session.result}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
