import type { EvaluationExtractionRunKeyMappingEntryDto } from "@caseai-connect/api-contracts"
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
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type {
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetSchemaColumn,
} from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import { selectIsExecuting } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.selectors"
import { evaluationExtractionRunsActions } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.slice"
import { useEvaluationExtractionRunPath } from "@/eval/hooks/use-evaluation-extraction-run-path"

type KeyMappingEntry = {
  agentOutputKey: string
  datasetColumnId: string
  mode: "scored" | "fyi"
}

export function RunEvaluationExtractionDialog({
  dataset,
}: {
  dataset: EvaluationExtractionDataset
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { buildRunPath } = useEvaluationExtractionRunPath()
  const agentsData = useAppSelector(selectAgentsData)
  const isExecuting = useAppSelector(selectIsExecuting)
  const [open, setOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [keyMapping, setKeyMapping] = useState<KeyMappingEntry[]>([])
  const [runScope, setRunScope] = useState<"all" | "limited">("all")
  const [limitedCount, setLimitedCount] = useState(1)

  const extractionAgents = useMemo(() => {
    if (!ADS.isFulfilled(agentsData)) return []
    return agentsData.value.filter((agent) => agent.type === "extraction")
  }, [agentsData])

  const targetColumns = useMemo(
    () =>
      Object.values(dataset.schemaMapping)
        .filter((column) => column.role === "target")
        .sort((columnA, columnB) => columnA.index - columnB.index),
    [dataset.schemaMapping],
  )

  const selectedAgent = useMemo(
    () => extractionAgents.find((agent) => agent.id === selectedAgentId) ?? null,
    [extractionAgents, selectedAgentId],
  )

  const agentOutputKeys = useMemo(() => {
    if (!selectedAgent?.outputJsonSchema) return []
    const properties = selectedAgent.outputJsonSchema.properties as
      | Record<string, unknown>
      | undefined
    if (!properties) return []
    return Object.keys(properties)
  }, [selectedAgent])

  const handleAgentChange = useCallback(
    (agentId: string) => {
      setSelectedAgentId(agentId)
      const agent = extractionAgents.find((extractionAgent) => extractionAgent.id === agentId)
      if (!agent?.outputJsonSchema) {
        setKeyMapping([])
        return
      }
      const properties = agent.outputJsonSchema.properties as Record<string, unknown> | undefined
      if (!properties) {
        setKeyMapping([])
        return
      }
      // Auto-map by matching names
      const newMapping: KeyMappingEntry[] = Object.keys(properties).map((outputKey) => {
        const matchingColumn = targetColumns.find(
          (column) => column.finalName.toLowerCase() === outputKey.toLowerCase(),
        )
        return {
          agentOutputKey: outputKey,
          datasetColumnId: matchingColumn?.id ?? "",
          mode: "scored" as const,
        }
      })
      setKeyMapping(newMapping)
    },
    [extractionAgents, targetColumns],
  )

  const handleColumnChange = useCallback((agentOutputKey: string, datasetColumnId: string) => {
    setKeyMapping((previous) =>
      previous.map((entry) =>
        entry.agentOutputKey === agentOutputKey ? { ...entry, datasetColumnId } : entry,
      ),
    )
  }, [])

  const handleModeChange = useCallback((agentOutputKey: string, mode: "scored" | "fyi") => {
    setKeyMapping((previous) =>
      previous.map((entry) =>
        entry.agentOutputKey === agentOutputKey ? { ...entry, mode } : entry,
      ),
    )
  }, [])

  const handleLimitedCountChange = useCallback(
    (value: string) => {
      const parsed = Number.parseInt(value, 10)
      if (!Number.isNaN(parsed)) {
        setLimitedCount(Math.min(Math.max(1, parsed), dataset.recordCount))
      }
    },
    [dataset.recordCount],
  )

  const isValid = useMemo(() => {
    if (!selectedAgentId) return false
    if (keyMapping.length === 0) return false
    if (runScope === "limited" && (limitedCount < 1 || limitedCount > dataset.recordCount))
      return false
    return keyMapping.every((entry) => entry.mode === "fyi" || entry.datasetColumnId !== "")
  }, [selectedAgentId, keyMapping, runScope, limitedCount, dataset.recordCount])

  const handleRun = async () => {
    if (!selectedAgentId || !isValid) return
    const validMapping: EvaluationExtractionRunKeyMappingEntryDto[] = keyMapping.map((entry) => ({
      agentOutputKey: entry.agentOutputKey,
      datasetColumnId: entry.datasetColumnId,
      mode: entry.mode,
    }))

    const result = await dispatch(
      evaluationExtractionRunsActions.createAndExecute({
        evaluationExtractionDatasetId: dataset.id,
        agentId: selectedAgentId,
        keyMapping: validMapping,
        recordLimit: runScope === "limited" ? limitedCount : null,
      }),
    ).unwrap()

    setOpen(false)
    navigate(buildRunPath({ runId: result.id }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlayIcon className="size-4" />
          {t("evaluationExtractionRun:run")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("evaluationExtractionRun:selectAgent")}</DialogTitle>
          <DialogDescription>
            {t("evaluationExtractionRun:selectAgentDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <AgentSelector
            agents={extractionAgents}
            selectedAgentId={selectedAgentId}
            onAgentChange={handleAgentChange}
          />

          {selectedAgent && agentOutputKeys.length > 0 && (
            <KeyMappingEditor
              agentOutputKeys={agentOutputKeys}
              targetColumns={targetColumns}
              keyMapping={keyMapping}
              onColumnChange={handleColumnChange}
              onModeChange={handleModeChange}
            />
          )}

          {selectedAgent && agentOutputKeys.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("evaluationExtractionRun:keyMapping.noOutputSchema")}
            </p>
          )}

          <RunScopeSelector
            recordCount={dataset.recordCount}
            runScope={runScope}
            limitedCount={limitedCount}
            onRunScopeChange={setRunScope}
            onLimitedCountChange={handleLimitedCountChange}
          />
        </div>

        <DialogFooter>
          <Button onClick={handleRun} disabled={!isValid || isExecuting}>
            {isExecuting ? t("evaluationExtractionRun:running") : t("evaluationExtractionRun:run")}
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
      <Label>{t("evaluationExtractionRun:agent")}</Label>
      <Select value={selectedAgentId ?? undefined} onValueChange={onAgentChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("evaluationExtractionRun:agentPlaceholder")} />
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

function KeyMappingEditor({
  agentOutputKeys,
  targetColumns,
  keyMapping,
  onColumnChange,
  onModeChange,
}: {
  agentOutputKeys: string[]
  targetColumns: EvaluationExtractionDatasetSchemaColumn[]
  keyMapping: KeyMappingEntry[]
  onColumnChange: (agentOutputKey: string, datasetColumnId: string) => void
  onModeChange: (agentOutputKey: string, mode: "scored" | "fyi") => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label>{t("evaluationExtractionRun:keyMapping.title")}</Label>
        <p className="text-sm text-muted-foreground">
          {t("evaluationExtractionRun:keyMapping.description")}
        </p>
      </div>

      <div className="rounded-lg border">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>{t("evaluationExtractionRun:keyMapping.agentOutputKey")}</span>
          {<span>{t("evaluationExtractionRun:keyMapping.datasetColumn")}</span>}
          <span>{t("evaluationExtractionRun:keyMapping.mode")}</span>
        </div>
        {agentOutputKeys.map((outputKey) => {
          const entry = keyMapping.find((mappingEntry) => mappingEntry.agentOutputKey === outputKey)
          return (
            <div
              key={outputKey}
              className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t px-3 py-2 items-center"
            >
              <span className="text-sm font-mono">{outputKey}</span>
              {entry?.mode === "fyi" ? (
                <div />
              ) : (
                <Select
                  value={entry?.datasetColumnId || undefined}
                  onValueChange={(value) => onColumnChange(outputKey, value)}
                >
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue
                      placeholder={t("evaluationExtractionRun:keyMapping.columnPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {targetColumns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.finalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select
                value={entry?.mode ?? "scored"}
                onValueChange={(value) => onModeChange(outputKey, value as "scored" | "fyi")}
              >
                <SelectTrigger className="w-[100px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scored">
                    {t("evaluationExtractionRun:keyMapping.scored")}
                  </SelectItem>
                  <SelectItem value="fyi">{t("evaluationExtractionRun:keyMapping.fyi")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
