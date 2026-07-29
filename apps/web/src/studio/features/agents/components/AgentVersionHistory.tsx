import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
import { HistoryIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import type { AgentSettings } from "@/common/features/agents/settings/agent-settings.models"
import { selectAgentSettingsData } from "@/common/features/agents/settings/agent-settings.selectors"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { AgentVersionExplorer } from "./AgentVersionExplorer"

/**
 * Entry point of the agent settings versioning UI: a trigger button showing the newest
 * revision (marked as a draft when it is not yet published, so an edit that only produced a
 * draft doesn't look live from outside the sheet), opening a side sheet with the revision
 * timeline, per-field diffs, restore and publish.
 */
export function AgentVersionHistory({
  agent,
  settings,
}: {
  agent: Agent
  settings: AgentSettings
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const history = useAppSelector(selectAgentSettingsData)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <HistoryIcon className="size-4" />
          {t("agent:history.button")}
          <Badge variant={settings.isDraft ? "outline" : "secondary"}>
            v{settings.revision}
            {settings.isDraft && ` · ${t("agent:history.draftBadge")}`}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-4xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t("agent:history.title")}</SheetTitle>
          <SheetDescription>
            {t("agent:history.description", { name: agent.name })}
          </SheetDescription>
        </SheetHeader>

        <AsyncRoute data={[history]}>
          <AgentVersionExplorer />
        </AsyncRoute>
      </SheetContent>
    </Sheet>
  )
}
