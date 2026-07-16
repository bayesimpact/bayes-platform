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
import { useMount } from "@/common/hooks/use-mount"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { selectAgentHistoryData } from "../agent-history.selectors"
import { agentHistoryActions } from "../agent-history.slice"
import { AgentVersionExplorer } from "./AgentVersionExplorer"

/**
 * Entry point of the agent settings versioning UI: a trigger button showing the current
 * revision, opening a side sheet with the revision timeline, per-field diffs and restore.
 */
export function AgentVersionHistory({ agent }: { agent: Agent }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const history = useAppSelector(selectAgentHistoryData)

  useMount({
    actions: agentHistoryActions,
    refreshOn: [agent.id],
  })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <HistoryIcon className="size-4" />
          {t("agent:history.button")}
          <Badge variant="secondary">v{agent.revision}</Badge>
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
