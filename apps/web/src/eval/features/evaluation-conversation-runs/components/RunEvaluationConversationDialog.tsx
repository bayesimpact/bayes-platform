import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Label } from "@caseai-connect/ui/shad/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { PlayIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { RunScopeSelector } from "@/common/components/shared/RunScopeSelector"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { EvaluationConversationDataset } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import { selectIsExecutingConversationRun } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.selectors"
import { evaluationConversationRunsActions } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.slice"
import { useEvaluationConversationRunPath } from "@/eval/hooks/use-evaluation-conversation-run-path"

type RunSettings = {
  selectedAgentId: string | null
  runScope: "all" | "limited"
  limitedCount: number
}

const defaultRunSettings: RunSettings = {
  selectedAgentId: null,
  runScope: "all",
  limitedCount: 1,
}

export function RunEvaluationConversationDialog({
  dataset,
}: {
  dataset: EvaluationConversationDataset
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { buildConversationRunPath } = useEvaluationConversationRunPath()
  const agentsData = useValue(selectAgentsData)
  const isExecuting = useAppSelector(selectIsExecutingConversationRun)
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<RunSettings>(defaultRunSettings)
  const { selectedAgentId, runScope, limitedCount } = settings

  const conversationAgents = useMemo(() => {
    return agentsData.filter((agent) => agent.type === "conversation")
  }, [agentsData])

  const handleAgentChange = useCallback((agentId: string) => {
    setSettings((previous) => ({ ...previous, selectedAgentId: agentId }))
  }, [])

  const handleRunScopeChange = useCallback((scope: "all" | "limited") => {
    setSettings((previous) => ({ ...previous, runScope: scope }))
  }, [])

  const handleLimitedCountChange = useCallback(
    (value: string) => {
      const parsed = Number.parseInt(value, 10)
      if (!Number.isNaN(parsed)) {
        setSettings((previous) => ({
          ...previous,
          limitedCount: Math.min(Math.max(1, parsed), dataset.recordCount),
        }))
      }
    },
    [dataset.recordCount],
  )

  const isValid = useMemo(() => {
    if (!selectedAgentId) return false
    if (runScope === "limited" && (limitedCount < 1 || limitedCount > dataset.recordCount))
      return false
    return true
  }, [selectedAgentId, runScope, limitedCount, dataset.recordCount])

  const handleRun = async () => {
    if (!selectedAgentId || !isValid) return

    const result = await dispatch(
      evaluationConversationRunsActions.createAndExecute({
        datasetId: dataset.id,
        agentId: selectedAgentId,
        recordLimit: runScope === "limited" ? limitedCount : null,
      }),
    ).unwrap()

    setOpen(false)
    navigate(buildConversationRunPath({ runId: result.id }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlayIcon className="size-4" />
          {t("evaluationConversationRun:run")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("evaluationConversationRun:selectAgent")}</DialogTitle>
          <DialogDescription>
            {t("evaluationConversationRun:selectAgentDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <AgentSelector
            agents={conversationAgents}
            selectedAgentId={selectedAgentId}
            onAgentChange={handleAgentChange}
          />

          {conversationAgents.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("evaluationConversationRun:noAgents")}
            </p>
          )}

          <RunScopeSelector
            recordCount={dataset.recordCount}
            runScope={runScope}
            limitedCount={limitedCount}
            onRunScopeChange={handleRunScopeChange}
            onLimitedCountChange={handleLimitedCountChange}
          />
        </div>

        <DialogFooter>
          <Button onClick={handleRun} disabled={!isValid || isExecuting}>
            {isExecuting
              ? t("evaluationConversationRun:running")
              : t("evaluationConversationRun:run")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AgentSelector({
  agents,
  selectedAgentId,
  onAgentChange,
}: {
  agents: Agent[]
  selectedAgentId: string | null
  onAgentChange: (agentId: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <Label>{t("evaluationConversationRun:agent")}</Label>
      <Select value={selectedAgentId ?? undefined} onValueChange={onAgentChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("evaluationConversationRun:agentPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
