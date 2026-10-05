import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
import { BrainIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { buildType } from "@/common/features/agents/agent-sessions/shared/base-agent-session/base-agent-sessions.thunks"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { selectAgentMemoriesData } from "../agent-memories.selectors"
import { clearAgentMemories, deleteAgentMemory } from "../agent-memories.thunks"

/**
 * The header button of a conversation: opens what the agent remembers about
 * the signed-in user, who can forget a fact or everything (ADR 0023).
 */
export function AgentMemoryPanel() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectAgentMemoriesData)
  const [confirmingClear, setConfirmingClear] = useState(false)
  if (!data) return null

  const memories = ADS.isFulfilled(data) ? data.value : []

  const handleClear = () => {
    setConfirmingClear(false)
    dispatch(clearAgentMemories())
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <BrainIcon />
          {t("agentMemories:panel.button")}
          {memories.length > 0 && <Badge variant="secondary">{memories.length}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("agentMemories:panel.title")}</SheetTitle>
          <SheetDescription>
            {t("agentMemories:panel.description")}
            {buildType() === "playground" && ` ${t("agentMemories:panel.playgroundDescription")}`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          {memories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("agentMemories:panel.empty")}</p>
          ) : (
            memories.map((memory) => (
              <div key={memory.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <div className="flex flex-1 flex-col gap-1">
                  <span>{memory.content}</span>
                  {memory.status === "pending" && (
                    <Badge variant="outline">{t("agentMemories:panel.pending")}</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("actions:delete")}
                  onClick={() => dispatch(deleteAgentMemory({ memoryId: memory.id }))}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))
          )}
        </div>
        {memories.length > 0 && (
          <SheetFooter>
            <Button variant="outline" onClick={() => setConfirmingClear(true)}>
              {t("agentMemories:panel.clearAll")}
            </Button>
          </SheetFooter>
        )}
        <ConfirmDialog
          open={confirmingClear}
          title={t("agentMemories:panel.clearAllConfirm")}
          confirmLabel={t("agentMemories:panel.clearAll")}
          onConfirm={handleClear}
          onCancel={() => setConfirmingClear(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
