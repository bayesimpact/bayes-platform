import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
import { ScrollTextIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { selectAgentSettingsDataByAgentId } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import type { Agent } from "@/common/features/agents/agents.models"
import { useValue } from "@/common/hooks/use-value"

/**
 * A button that shows the instructions of an agent in a full-page sheet, read-only. It lets the
 * user check what an agent does before they make it a sub-agent.
 */
export function AgentInstructionsSheet({ agent }: { agent: Agent }) {
  const { t } = useTranslation()
  const agentSettings = useValue(selectAgentSettingsDataByAgentId({ agentId: agent.id }))

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ScrollTextIcon />
          {t("agentSettings:props.instructions")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-none">
        <SheetHeader className="border-b">
          <SheetTitle>{agent.name}</SheetTitle>
          <SheetDescription>{t("agentSettings:props.instructions")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {/* As in the editor: the text as it was written, in a monospace font. */}
          <pre className="mx-auto w-full max-w-4xl whitespace-pre-wrap p-6 font-mono text-sm">
            {agentSettings.instructions}
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  )
}
