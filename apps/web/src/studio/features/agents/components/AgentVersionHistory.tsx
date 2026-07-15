import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
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
import { Skeleton } from "@caseai-connect/ui/shad/skeleton"
import { AlertTriangleIcon, HistoryIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { selectAgentHistoryData } from "../agent-history.selectors"
import { listAgentHistory } from "../agent-history.thunks"
import { AgentVersionExplorer } from "./AgentVersionExplorer"

/**
 * Entry point of the agent settings versioning UI: a trigger button showing the current
 * revision, opening a side sheet with the revision timeline, per-field diffs and restore.
 */
export function AgentVersionHistory({ agent }: { agent: Agent }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const history = useAppSelector(selectAgentHistoryData)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) dispatch(listAgentHistory())
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

        {ADS.isFulfilled(history) ? (
          <AgentVersionExplorer versions={history.value} />
        ) : ADS.isError(history) ? (
          <Alert variant="destructive" className="m-4 w-auto">
            <AlertTriangleIcon className="size-4" />
            <AlertTitle>{t("agent:history.loadError")}</AlertTitle>
            <AlertDescription>{history.error}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
