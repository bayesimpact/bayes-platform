import {
  AgentModel,
  AgentModelToAgentProvider,
  AgentProvider,
  createEvaluationConversationRunSchema,
  EVALUATION_CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH,
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlayIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { type Control, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { z } from "zod"
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

type RunFormValues = {
  agentId: string
  // null = no explicit choice yet; the newest revision is used once history loads.
  selectedRevision: number | null
  judgeModel: AgentModel
  judgeInstructions: string
  runScope: "all" | "limited"
  limitedCount: number
}

const defaultRunFormValues: RunFormValues = {
  agentId: "",
  selectedRevision: null,
  judgeModel: AgentModel.Gemini25Flash,
  judgeInstructions: "",
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

  const latestRevision = agentHistory[0]?.revision ?? null

  // Contract schema extended with the dialog-only fields and translated
  // validation messages (ADR 0012). Depends on latestRevision so the version
  // rule re-validates once the agent history loads.
  const formSchema = useMemo(
    () =>
      createEvaluationConversationRunSchema
        .omit({ datasetId: true, agentSettingsRevision: true, judgeInstructions: true })
        .extend({
          selectedRevision: z.number().int().nullable(),
          judgeInstructions: z
            .string()
            .max(EVALUATION_CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH),
          runScope: z.enum(["all", "limited"]),
          limitedCount: z.number().int().min(1),
        })
        .refine((values) => values.agentId.length > 0, {
          path: ["agentId"],
          message: t("evaluationConversationRun:agentPlaceholder"),
        })
        .refine((values) => values.selectedRevision !== null || latestRevision !== null, {
          path: ["selectedRevision"],
          message: t("evaluationConversationRun:version.placeholder"),
        }),
    [t, latestRevision],
  )

  const form = useForm<RunFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultRunFormValues,
  })
  const { control, watch, setValue } = form

  const selectedAgentId = watch("agentId")
  const selectedRevision = watch("selectedRevision")
  const runScope = watch("runScope")
  const limitedCount = watch("limitedCount")

  const isHistoryLoading = selectedAgentId !== "" && !ADS.isFulfilled(agentHistoryData)
  const effectiveRevision = selectedRevision ?? latestRevision

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        form.reset(defaultRunFormValues)
        dispatch(evaluationConversationRunsActions.resetAgentHistory())
      }
    },
    [dispatch, form],
  )

  const handleAgentChange = useCallback(
    (agentId: string) => {
      setValue("selectedRevision", null)
      dispatch(evaluationConversationRunsActions.resetAgentHistory())
      dispatch(evaluationConversationRunsActions.getAgentHistory({ agentId }))
    },
    [dispatch, setValue],
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
    const agentSettingsRevision = values.selectedRevision ?? latestRevision
    if (agentSettingsRevision === null) return

    const result = await dispatch(
      evaluationConversationRunsActions.createAndExecute({
        datasetId: dataset.id,
        agentId: values.agentId,
        agentSettingsRevision,
        judgeModel: values.judgeModel,
        judgeInstructions: values.judgeInstructions.trim() || null,
        recordLimit: values.runScope === "limited" ? values.limitedCount : null,
      }),
    ).unwrap()

    setOpen(false)
    navigate(buildConversationRunPath({ runId: result.id }))
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlayIcon className="size-4" />
          {t("evaluationConversationRun:run")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <Form {...form}>
          <form onSubmit={handleRun}>
            <DialogHeader>
              <DialogTitle>{t("evaluationConversationRun:selectAgent")}</DialogTitle>
              <DialogDescription>
                {t("evaluationConversationRun:selectAgentDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <AgentField
                control={control}
                agents={conversationAgents}
                onAgentChange={handleAgentChange}
              />

              {conversationAgents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("evaluationConversationRun:noAgents")}
                </p>
              )}

              {selectedAgentId && (
                <AgentVersionField
                  control={control}
                  history={agentHistory}
                  isLoading={isHistoryLoading}
                  effectiveRevision={effectiveRevision}
                />
              )}

              <JudgeModelField control={control} models={judgeModels} />

              <JudgeInstructionsField control={control} />

              <RunScopeSelector
                recordCount={dataset.recordCount}
                runScope={runScope}
                limitedCount={limitedCount}
                onRunScopeChange={(scope) => setValue("runScope", scope)}
                onLimitedCountChange={handleLimitedCountChange}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting || isExecuting}>
                {isExecuting
                  ? t("evaluationConversationRun:running")
                  : t("evaluationConversationRun:run")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function AgentField({
  control,
  agents,
  onAgentChange,
}: {
  control: Control<RunFormValues>
  agents: Agent[]
  onAgentChange: (agentId: string) => void
}) {
  const { t } = useTranslation()

  return (
    <FormField
      control={control}
      name="agentId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("evaluationConversationRun:agent")}</FormLabel>
          <Select
            value={field.value || undefined}
            onValueChange={(agentId) => {
              field.onChange(agentId)
              onAgentChange(agentId)
            }}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("evaluationConversationRun:agentPlaceholder")} />
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
  isLoading,
  effectiveRevision,
}: {
  control: Control<RunFormValues>
  history: Agent[]
  isLoading: boolean
  effectiveRevision: number | null
}) {
  const { t } = useTranslation()

  return (
    <FormField
      control={control}
      name="selectedRevision"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("evaluationConversationRun:version.label")}</FormLabel>
          <Select
            value={effectiveRevision !== null ? String(effectiveRevision) : undefined}
            onValueChange={(value) => {
              const parsed = Number.parseInt(value, 10)
              if (!Number.isNaN(parsed)) field.onChange(parsed)
            }}
            disabled={isLoading || history.length === 0}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    isLoading
                      ? t("evaluationConversationRun:version.loading")
                      : t("evaluationConversationRun:version.placeholder")
                  }
                />
              </SelectTrigger>
            </FormControl>
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
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function JudgeModelField({
  control,
  models,
}: {
  control: Control<RunFormValues>
  models: [string, AgentModel][]
}) {
  const { t } = useTranslation()

  return (
    <FormField
      control={control}
      name="judgeModel"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("evaluationConversationRun:judgeModel.label")}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("evaluationConversationRun:judgeModel.placeholder")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {models.map(([key, value]) => (
                <SelectItem key={key} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>{t("evaluationConversationRun:judgeModel.description")}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function JudgeInstructionsField({ control }: { control: Control<RunFormValues> }) {
  const { t } = useTranslation()

  return (
    <FormField
      control={control}
      name="judgeInstructions"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("evaluationConversationRun:judgeInstructions.label")}</FormLabel>
          <FormControl>
            <Textarea
              placeholder={t("evaluationConversationRun:judgeInstructions.placeholder")}
              rows={3}
              maxLength={EVALUATION_CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH}
              {...field}
            />
          </FormControl>
          <FormDescription>
            {t("evaluationConversationRun:judgeInstructions.description")}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
