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
import { FormResultFields } from "@/common/features/agents/agent-sessions/conversation/components/FormResultFields"
import type { FormResultEntry } from "./form-result-context"

/**
 * Opens a sheet with every form of the conversation, one tab per agent: the
 * sub-agents that took the conversation over, the relay sub-agents with a
 * form, and the session's own agent when it has one. The tab of the agent
 * that wrote the message is selected by default.
 */
export function SubAgentFormResultSheet({
  forms,
  defaultAgentId,
}: {
  forms: FormResultEntry[]
  defaultAgentId?: string
}) {
  const { t } = useTranslation()

  if (forms.length === 0) return null
  const defaultValue = forms.some((form) => form.agentId === defaultAgentId)
    ? defaultAgentId
    : forms[0]?.agentId

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
          <ClipboardListIcon className="size-3.5" />
          {t("conversationAgentSession:subAgentResults.view")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("conversationAgentSession:subAgentResults.title")}</SheetTitle>
          <SheetDescription>
            {t("conversationAgentSession:subAgentResults.description")}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <Tabs defaultValue={defaultValue}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start">
              {forms.map((form) => (
                <TabsTrigger key={form.agentId} value={form.agentId}>
                  {form.agentName}
                </TabsTrigger>
              ))}
            </TabsList>
            {forms.map((form) => (
              <TabsContent key={form.agentId} value={form.agentId}>
                <FormResultFields outputJsonSchema={form.outputJsonSchema} result={form.result} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
