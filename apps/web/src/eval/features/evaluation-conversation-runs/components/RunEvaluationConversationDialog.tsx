import {
  type AgentModel,
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
import {
  buildAgentModelOptions,
  formatAgentModelLabel,
} from "@/common/features/agents/agent-model.helpers"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { selectAgentSettingsHistoryDataByAgentId } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import type { Agent, AgentModelsCatalog } from "@/common/features/agents/agents.models"
import {
  selectAgentsData,
  selectAvailableModelsData,
} from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDate } from "@/common/utils/build-date"
import type { EvaluationConversationDataset } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import {
  buildCreateRunPayload,
  buildDefaultRunFormValues,
  type RunFormValues,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.helpers"
import { selectIsExecutingConversationRun } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.selectors"
import { evaluationConversationRunsActions } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.slice"
import { useEvaluationConversationRunPath } from "@/eval/hooks/use-evaluation-conversation-run-path"

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
  const catalog = useValue(selectAvailableModelsData)

  const isExecuting = useAppSelector(selectIsExecutingConversationRun)
  const [open, setOpen] = useState(false)

  const judgeModels = useMemo(() => buildAgentModelOptions(catalog), [catalog])
  const defaultJudgeModel = catalog.defaults.judge

  const conversationAgents = useMemo(() => {
    return agentsData.filter((agent) => agent.type === "conversation")
  }, [agentsData])

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
        .refine((values) => values.selectedRevision !== null, {
          path: ["selectedRevision"],
          message: t("evaluationConversationRun:version.placeholder"),
        }),
    [t],
  )

  const form = useForm<RunFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaultRunFormValues(defaultJudgeModel),
  })
  const { control, watch, setValue } = form

  const selectedAgentId = watch("agentId")

  const agentSettingsHistory = useValue(
    selectAgentSettingsHistoryDataByAgentId({ agentId: selectedAgentId ?? "", includeDraft: true }),
  )

  const selectedRevision = watch("selectedRevision")
  const runScope = watch("runScope")
  const limitedCount = watch("limitedCount")

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        form.reset(buildDefaultRunFormValues(defaultJudgeModel))
      }
    },
    [form, defaultJudgeModel],
  )

  const handleAgentChange = useCallback(
    (agentId: string) => {
      setValue("agentId", agentId)
      setValue("selectedRevision", null)
    },
    [setValue],
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
    const payload = buildCreateRunPayload({ datasetId: dataset.id, values })
    if (!payload) return

    const result = await dispatch(
      evaluationConversationRunsActions.createAndExecute(payload),
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
                  history={agentSettingsHistory}
                  isLoading={false}
                  effectiveRevision={selectedRevision}
                />
              )}

              <JudgeModelField control={control} models={judgeModels} catalog={catalog} />

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
  history: AgentSettings[]
  isLoading: boolean
  effectiveRevision: number | null
}) {
  const { t } = useTranslation()

  // The newest non-draft revision: the one the agent actually runs with.
  const publishedRevision = history.find((agentVersion) => !agentVersion.isDraft)?.revision

  const buildVersionDetail = (agentVersion: AgentSettings) => {
    if (agentVersion.isDraft) return t("status:draft")
    if (agentVersion.revision === publishedRevision)
      return t("evaluationConversationRun:version.current", {
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
              {history.map((agentVersion) => (
                <SelectItem key={agentVersion.revision} value={String(agentVersion.revision)}>
                  {t("evaluationConversationRun:version.item", {
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

function JudgeModelField({
  control,
  models,
  catalog,
}: {
  control: Control<RunFormValues>
  models: AgentModel[]
  catalog: AgentModelsCatalog
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
              {models.map((model) => (
                <SelectItem key={model} value={model}>
                  {formatAgentModelLabel(model, catalog, {
                    deprecatedSuffix: t("agent:model.deprecatedSuffix"),
                    nonEuSuffix: t("agent:model.nonEuSuffix"),
                  })}
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
