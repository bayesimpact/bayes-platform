import {
  createEvaluationExtractionRunSchema,
  type EvaluationExtractionRunKeyMappingEntryDto,
} from "@caseai-connect/api-contracts"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Label } from "@caseai-connect/ui/shad/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlayIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { type Control, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { z } from "zod"
import { Loader } from "@/common/components/Loader"
import { RunScopeSelector } from "@/common/components/shared/RunScopeSelector"
import {
  findPublishedVersion,
  findVersion,
} from "@/common/features/agents/agent-settings/agent-settings.functions"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { selectAgentSettingsHistoryDataByAgentId } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDate } from "@/common/utils/build-date"
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

type RunFormValues = {
  agentId: string
  // null = no explicit choice; the latest published revision is used once history loads.
  selectedRevision: number | null
  keyMapping: KeyMappingEntry[]
  runScope: "all" | "limited"
  limitedCount: number
}

const defaultRunFormValues: RunFormValues = {
  agentId: "",
  selectedRevision: null,
  keyMapping: [],
  runScope: "all",
  limitedCount: 1,
}

function getAgentOutputKeys(agentSettings: AgentSettings): string[] {
  const properties = agentSettings.outputJsonSchema?.properties as
    | Record<string, unknown>
    | undefined
  if (!properties) return []
  return Object.keys(properties)
}

function buildDefaultKeyMapping({
  agentSettings,
  targetColumns,
}: {
  agentSettings: AgentSettings
  targetColumns: EvaluationExtractionDatasetSchemaColumn[]
}): KeyMappingEntry[] {
  // Auto-map by matching names
  return getAgentOutputKeys(agentSettings).map((outputKey) => {
    const matchingColumn = targetColumns.find(
      (column) => column.finalName.toLowerCase() === outputKey.toLowerCase(),
    )
    return {
      agentOutputKey: outputKey,
      datasetColumnId: matchingColumn?.id ?? "",
      mode: "scored" as const,
    }
  })
}

export function RunEvaluationExtractionDialog({
  dataset,
}: {
  dataset: EvaluationExtractionDataset
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

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

        <RunEvaluationExtractionForm dataset={dataset} onRan={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RunEvaluationExtractionForm({
  dataset,
  onRan,
}: {
  dataset: EvaluationExtractionDataset
  onRan: () => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { buildRunPath } = useEvaluationExtractionRunPath()
  const isExecuting = useAppSelector(selectIsExecuting)
  const agentsData = useValue(selectAgentsData)

  const extractionAgents = useMemo(() => {
    return agentsData.filter((agent) => agent.type === "extraction")
  }, [agentsData])

  const targetColumns = useMemo(
    () =>
      Object.values(dataset.schemaMapping)
        .filter((column) => column.role === "target")
        .sort((columnA, columnB) => columnA.index - columnB.index),
    [dataset.schemaMapping],
  )

  // Contract schema extended with the dialog-only fields and translated
  // validation messages (ADR 0012).
  const formSchema = useMemo(
    () =>
      createEvaluationExtractionRunSchema
        .omit({ evaluationExtractionDatasetId: true, agentSettingsRevision: true })
        .extend({
          selectedRevision: z.number().int().nullable(),
          runScope: z.enum(["all", "limited"]),
          limitedCount: z.number().int().min(1),
        })
        .refine((values) => values.agentId.length > 0, {
          path: ["agentId"],
          message: t("evaluationExtractionRun:agentPlaceholder"),
        })
        .refine((values) => values.keyMapping.length > 0, {
          path: ["keyMapping"],
          message: t("evaluationExtractionRun:keyMapping.noOutputSchema"),
        })
        .refine(
          (values) =>
            values.keyMapping.every(
              (entry) => entry.mode === "fyi" || entry.datasetColumnId !== "",
            ),
          {
            path: ["keyMapping"],
            message: t("evaluationExtractionRun:keyMapping.incomplete"),
          },
        ),
    [t],
  )

  const form = useForm<RunFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultRunFormValues,
  })
  const { control, watch, setValue, getValues } = form

  const selectedAgentId = watch("agentId")
  const selectedRevision = watch("selectedRevision")
  const runScope = watch("runScope")
  const limitedCount = watch("limitedCount")
  const keyMapping = watch("keyMapping")

  const agentSettingsHistoryData = useAppSelector(
    selectAgentSettingsHistoryDataByAgentId({ agentId: selectedAgentId, includeDraft: true }),
  )
  const history = ADS.isFulfilled(agentSettingsHistoryData)
    ? agentSettingsHistoryData.value
    : undefined

  // The user's explicit pick, defaulting to the latest published revision — the
  // version the server would pin if the payload carried none — or to the draft of
  // an agent that was never published, such as a fresh copy.
  const effectiveRevision =
    selectedRevision ??
    (history ? ((findPublishedVersion(history) ?? history[0])?.revision ?? null) : null)
  const selectedVersion =
    history && effectiveRevision !== null ? findVersion(history, effectiveRevision) : undefined

  // The key mapping derives from the chosen version's output schema, so it must be
  // rebuilt whenever the effective version changes.
  useEffect(() => {
    setValue(
      "keyMapping",
      selectedVersion
        ? buildDefaultKeyMapping({ agentSettings: selectedVersion, targetColumns })
        : [],
    )
  }, [setValue, selectedVersion, targetColumns])

  const agentOutputKeys = useMemo(
    () => (selectedVersion ? getAgentOutputKeys(selectedVersion) : []),
    [selectedVersion],
  )

  const handleAgentChange = useCallback(() => {
    setValue("selectedRevision", null)
  }, [setValue])

  const handleColumnChange = useCallback(
    (agentOutputKey: string, datasetColumnId: string) => {
      setValue(
        "keyMapping",
        getValues("keyMapping").map((entry) =>
          entry.agentOutputKey === agentOutputKey ? { ...entry, datasetColumnId } : entry,
        ),
        { shouldValidate: true },
      )
    },
    [setValue, getValues],
  )

  const handleModeChange = useCallback(
    (agentOutputKey: string, mode: "scored" | "fyi") => {
      setValue(
        "keyMapping",
        getValues("keyMapping").map((entry) =>
          entry.agentOutputKey === agentOutputKey ? { ...entry, mode } : entry,
        ),
        { shouldValidate: true },
      )
    },
    [setValue, getValues],
  )

  const handleLimitedCountChange = useCallback(
    (value: string) => {
      const parsed = Number.parseInt(value, 10)
      if (!Number.isNaN(parsed)) {
        setValue("limitedCount", Math.min(Math.max(1, parsed), dataset.recordCount))
      }
    },
    [setValue, dataset.recordCount],
  )

  const handleRun = form.handleSubmit(async (values) => {
    if (effectiveRevision === null) return
    const validMapping: EvaluationExtractionRunKeyMappingEntryDto[] = values.keyMapping.map(
      (entry) => ({
        agentOutputKey: entry.agentOutputKey,
        datasetColumnId: entry.datasetColumnId,
        mode: entry.mode,
      }),
    )

    const result = await dispatch(
      evaluationExtractionRunsActions.createAndExecute({
        evaluationExtractionDatasetId: dataset.id,
        agentId: values.agentId,
        agentSettingsRevision: effectiveRevision,
        keyMapping: validMapping,
        recordLimit: values.runScope === "limited" ? values.limitedCount : null,
      }),
    ).unwrap()

    onRan()
    navigate(buildRunPath({ runId: result.id }))
  })

  return (
    <Form {...form}>
      <form onSubmit={handleRun} className="flex flex-col gap-4">
        <AgentField control={control} agents={extractionAgents} onAgentChange={handleAgentChange} />

        {selectedAgentId &&
          (ADS.isError(agentSettingsHistoryData) ? (
            <p className="text-sm text-destructive">
              {t("evaluationExtractionRun:agentSettingsUnavailable")}
            </p>
          ) : !history ? (
            <Loader />
          ) : (
            <>
              <AgentVersionField
                control={control}
                history={history}
                effectiveRevision={effectiveRevision}
              />

              {agentOutputKeys.length > 0 ? (
                <FormField
                  control={control}
                  name="keyMapping"
                  render={() => (
                    <FormItem>
                      <KeyMappingEditor
                        agentOutputKeys={agentOutputKeys}
                        targetColumns={targetColumns}
                        keyMapping={keyMapping}
                        onColumnChange={handleColumnChange}
                        onModeChange={handleModeChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("evaluationExtractionRun:keyMapping.noOutputSchema")}
                </p>
              )}

              <RunScopeSelector
                recordCount={dataset.recordCount}
                runScope={runScope}
                limitedCount={limitedCount}
                onRunScopeChange={(scope) => setValue("runScope", scope)}
                onLimitedCountChange={handleLimitedCountChange}
              />
            </>
          ))}

        <DialogFooter>
          <Button
            type="submit"
            disabled={!selectedAgentId || form.formState.isSubmitting || isExecuting}
          >
            {isExecuting ? t("evaluationExtractionRun:running") : t("evaluationExtractionRun:run")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function AgentField({
  control,
  agents,
  onAgentChange,
}: {
  control: Control<RunFormValues>
  agents: Agent[]
  onAgentChange: () => void
}) {
  const { t } = useTranslation()

  return (
    <FormField
      control={control}
      name="agentId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("evaluationExtractionRun:agent")}</FormLabel>
          <Select
            value={field.value || undefined}
            onValueChange={(agentId) => {
              field.onChange(agentId)
              onAgentChange()
            }}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("evaluationExtractionRun:agentPlaceholder")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function AgentVersionField({
  control,
  history,
  effectiveRevision,
}: {
  control: Control<RunFormValues>
  history: AgentSettings[]
  effectiveRevision: number | null
}) {
  const { t } = useTranslation()

  // The newest non-draft revision: the one the agent actually runs with.
  const publishedRevision = findPublishedVersion(history)?.revision

  const buildVersionDetail = (agentVersion: AgentSettings) => {
    if (agentVersion.isDraft) return t("status:draft")
    if (agentVersion.revision === publishedRevision)
      return t("evaluationExtractionRun:version.current", {
        date: buildDate(agentVersion.updatedAt),
      })
    return buildDate(agentVersion.updatedAt)
  }

  return (
    <FormField
      control={control}
      name="selectedRevision"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("evaluationExtractionRun:version.label")}</FormLabel>
          <Select
            value={effectiveRevision !== null ? String(effectiveRevision) : undefined}
            onValueChange={(value) => {
              const parsed = Number.parseInt(value, 10)
              if (!Number.isNaN(parsed)) field.onChange(parsed)
            }}
            disabled={history.length === 0}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("evaluationExtractionRun:version.placeholder")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {history.map((agentVersion) => (
                <SelectItem key={agentVersion.revision} value={String(agentVersion.revision)}>
                  {t("evaluationExtractionRun:version.item", {
                    revision: agentVersion.revision,
                    detail: buildVersionDetail(agentVersion),
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
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
