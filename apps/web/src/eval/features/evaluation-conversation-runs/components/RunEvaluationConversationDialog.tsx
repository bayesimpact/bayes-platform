import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
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
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDate } from "@/common/utils/build-date"
import type { EvaluationConversationDataset } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import {
  selectConversationRunAgentHistory,
  selectIsExecutingConversationRun,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.selectors"
import { evaluationConversationRunsActions } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.slice"
import { useEvaluationConversationRunPath } from "@/eval/hooks/use-evaluation-conversation-run-path"

type RunSettings = {
  selectedAgentId: string | null
  // null = no explicit choice yet; the newest revision is used once history loads.
  selectedRevision: number | null
  judgeModel: AgentModel
  runScope: "all" | "limited"
  limitedCount: number
}

const defaultRunSettings: RunSettings = {
  selectedAgentId: null,
  selectedRevision: null,
  judgeModel: AgentModel.Gemini25Flash,
  runScope: "all",
  limitedCount: 1,
}

// Mirrors AgentModelTab.extractModelList: the Vertex provider models are always
// available; the other provider groups are gated behind the matching project
// feature flag. AgentModel._Mock is naturally excluded (its provider is _Mock).
function extractJudgeModelList(
  hasFeature: ReturnType<typeof useFeatureFlags>["hasFeature"],
): [string, AgentModel][] {
  const allEntries = Object.entries(AgentModel) as [string, AgentModel][]
  const byProvider = (provider: AgentProvider) =>
    allEntries.filter(([_key, value]) => AgentModelToAgentProvider[value] === provider)

  const defaultModels = byProvider(AgentProvider.Vertex)
  const medGemmaModels = hasFeature("medgemma") ? byProvider(AgentProvider.MedGemma) : []
  const gemmaModels = hasFeature("gemma") ? byProvider(AgentProvider.Gemma) : []
  const vertex3Models = hasFeature("vertex-3") ? byProvider(AgentProvider.Vertex3) : []
  const mistralModels = hasFeature("mistral") ? byProvider(AgentProvider.Mistral) : []

  return [...defaultModels, ...medGemmaModels, ...gemmaModels, ...vertex3Models, ...mistralModels]
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
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const agentHistoryData = useAppSelector(selectConversationRunAgentHistory)
  const isExecuting = useAppSelector(selectIsExecutingConversationRun)
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<RunSettings>(defaultRunSettings)
  const { selectedAgentId, selectedRevision, judgeModel, runScope, limitedCount } = settings

  const judgeModels = useMemo(() => extractJudgeModelList(hasFeature), [hasFeature])

  const conversationAgents = useMemo(() => {
    return agentsData.filter((agent) => agent.type === "conversation")
  }, [agentsData])

  const agentHistory = useMemo(() => {
    if (!ADS.isFulfilled(agentHistoryData)) return []
    return [...agentHistoryData.value].sort(
      (olderVersion, newerVersion) => newerVersion.revision - olderVersion.revision,
    )
  }, [agentHistoryData])

  const isHistoryLoading = selectedAgentId !== null && !ADS.isFulfilled(agentHistoryData)
  const latestRevision = agentHistory[0]?.revision ?? null
  const effectiveRevision = selectedRevision ?? latestRevision

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        setSettings(defaultRunSettings)
        dispatch(evaluationConversationRunsActions.resetAgentHistory())
      }
    },
    [dispatch],
  )

  const handleAgentChange = useCallback(
    (agentId: string) => {
      setSettings((previous) => ({ ...previous, selectedAgentId: agentId, selectedRevision: null }))
      dispatch(evaluationConversationRunsActions.resetAgentHistory())
      dispatch(evaluationConversationRunsActions.getAgentHistory({ agentId }))
    },
    [dispatch],
  )

  const handleRevisionChange = useCallback((value: string) => {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isNaN(parsed)) {
      setSettings((previous) => ({ ...previous, selectedRevision: parsed }))
    }
  }, [])

  const handleRunScopeChange = useCallback((scope: "all" | "limited") => {
    setSettings((previous) => ({ ...previous, runScope: scope }))
  }, [])

  const handleJudgeModelChange = useCallback((value: string) => {
    setSettings((previous) => ({ ...previous, judgeModel: value as AgentModel }))
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
    if (effectiveRevision === null) return false
    if (runScope === "limited" && (limitedCount < 1 || limitedCount > dataset.recordCount))
      return false
    return true
  }, [selectedAgentId, effectiveRevision, runScope, limitedCount, dataset.recordCount])

  const handleRun = async () => {
    if (!selectedAgentId || effectiveRevision === null || !isValid) return

    const result = await dispatch(
      evaluationConversationRunsActions.createAndExecute({
        datasetId: dataset.id,
        agentId: selectedAgentId,
        agentSettingsRevision: effectiveRevision,
        judgeModel,
        recordLimit: runScope === "limited" ? limitedCount : null,
      }),
    ).unwrap()

    setOpen(false)
    navigate(buildConversationRunPath({ runId: result.id }))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

          {selectedAgentId && (
            <AgentVersionSelector
              history={agentHistory}
              isLoading={isHistoryLoading}
              selectedRevision={effectiveRevision}
              onRevisionChange={handleRevisionChange}
            />
          )}

          <JudgeModelSelector
            models={judgeModels}
            selectedModel={judgeModel}
            onModelChange={handleJudgeModelChange}
          />

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

function AgentVersionSelector({
  history,
  isLoading,
  selectedRevision,
  onRevisionChange,
}: {
  history: Agent[]
  isLoading: boolean
  selectedRevision: number | null
  onRevisionChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <Label>{t("evaluationConversationRun:version.label")}</Label>
      <Select
        value={selectedRevision !== null ? String(selectedRevision) : undefined}
        onValueChange={onRevisionChange}
        disabled={isLoading || history.length === 0}
      >
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={
              isLoading
                ? t("evaluationConversationRun:version.loading")
                : t("evaluationConversationRun:version.placeholder")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {history.map((agentVersion, index) => (
            <SelectItem key={agentVersion.revision} value={String(agentVersion.revision)}>
              {index === 0
                ? t("evaluationConversationRun:version.latest", {
                    revision: agentVersion.revision,
                  })
                : t("evaluationConversationRun:version.item", {
                    revision: agentVersion.revision,
                    date: buildDate(agentVersion.updatedAt),
                  })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function JudgeModelSelector({
  models,
  selectedModel,
  onModelChange,
}: {
  models: [string, AgentModel][]
  selectedModel: AgentModel
  onModelChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <Label>{t("evaluationConversationRun:judgeModel.label")}</Label>
      <Select value={selectedModel} onValueChange={onModelChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("evaluationConversationRun:judgeModel.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {models.map(([key, value]) => (
            <SelectItem key={key} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        {t("evaluationConversationRun:judgeModel.description")}
      </p>
    </div>
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
