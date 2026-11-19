import {
  type AgentParamsDto,
  CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH,
  type ConversationDatasetOutputDto,
  type ConversationRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { PlayIcon } from "lucide-react"
import { useId } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import type { EvaluationAgent } from "@/features/agents"
import { useStartConversationRun } from "../api/mutations"
import { agentSavedVersionsQueryOptions, judgeModelsQueryOptions } from "../api/queries"

/** What the dialog asks: the version to evaluate, the judge, and how much of the dataset to ask. */
const runFormSchema = z.object({
  revision: z.number().int(),
  judgeModel: z.string().min(1),
  judgeInstructions: z.string().max(CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH),
  scope: z.enum(["all", "limited"]),
  limitedCount: z.number().int().min(1),
})

export type RunEvaluationDialogProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  dataset: ConversationDatasetOutputDto
  onClose: () => void
  /** Called with the run once it started, for its owner to open it. */
  onStarted: (run: ConversationRunOutputDto) => void
}

/**
 * Starts an evaluation of the agent over a dataset: a saved version of the agent answers the
 * dataset's records, and a judge model grades each answer. Its owner mounts it while it shows.
 */
export function RunEvaluationDialog({
  agent,
  agentParams,
  dataset,
  onClose,
  onStarted,
}: RunEvaluationDialogProps) {
  const { t } = useLingui()
  const versionId = useId()
  const judgeModelId = useId()
  const judgeInstructionsId = useId()
  const limitedCountId = useId()
  const allRecordsId = useId()
  const firstRecordsId = useId()
  const { data: versions } = useSuspenseQuery(agentSavedVersionsQueryOptions(agentParams))
  const { data: judge } = useSuspenseQuery(judgeModelsQueryOptions(agentParams))
  const startRun = useStartConversationRun(agentParams)
  // The version in production first: it is the one the agent's users talk to.
  const defaultVersion = versions.find((version) => version.isProduction) ?? versions[0]
  const form = useForm({
    resolver: zodResolver(runFormSchema),
    defaultValues: {
      revision: defaultVersion?.revision ?? 0,
      judgeModel: judge.models.includes(judge.defaultModel)
        ? judge.defaultModel
        : (judge.models[0] ?? ""),
      judgeInstructions: "",
      scope: "all" as const,
      limitedCount: Math.min(10, dataset.recordCount),
    },
  })
  const scope = useWatch({ control: form.control, name: "scope" })
  const agentName = agent.name
  const datasetName = dataset.name
  const recordCount = dataset.recordCount
  const canRun = versions.length > 0 && judge.models.length > 0
  const handleSubmit = form.handleSubmit((values) =>
    startRun.mutate(
      {
        agentId: agentParams.agentId,
        agentSettingsRevision: values.revision,
        datasetId: dataset.id,
        judgeModel: values.judgeModel,
        judgeInstructions: values.judgeInstructions.trim() || null,
        recordLimit: values.scope === "limited" ? values.limitedCount : null,
      },
      {
        onSuccess: (run) => {
          toast.success(t`The evaluation started.`)
          onStarted(run)
        },
        onError: () => toast.error(t`The evaluation could not start. Try again.`),
      },
    ),
  )
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <Trans>Run an evaluation</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              {agentName} answers the records of {datasetName}, and a judge model grades each answer
              against the expected output.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
          noValidate
        >
          <Controller
            control={form.control}
            name="revision"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={versionId}>
                  <Trans comment="The saved version of an agent that an evaluation asks">
                    Agent version
                  </Trans>
                </FieldLabel>
                {versions.length === 0 ? (
                  <FieldError>
                    <Trans>
                      This agent has no saved version yet. Save one in the Studio, then run the
                      evaluation.
                    </Trans>
                  </FieldError>
                ) : (
                  <NativeSelect
                    id={versionId}
                    value={field.value}
                    onChange={(event) => field.onChange(Number(event.target.value))}
                  >
                    {versions.map((version) => {
                      const revision = version.revision
                      return (
                        <NativeSelectOption key={revision} value={revision}>
                          {version.isProduction
                            ? t`Version ${revision} · In production`
                            : t`Version ${revision}`}
                        </NativeSelectOption>
                      )
                    })}
                  </NativeSelect>
                )}
                <FieldDescription>
                  <Trans>A run evaluates a saved version, never the draft.</Trans>
                </FieldDescription>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="judgeModel"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={judgeModelId}>
                  <Trans comment="The model that grades the answers of an evaluation">
                    Judge model
                  </Trans>
                </FieldLabel>
                <NativeSelect id={judgeModelId} {...field}>
                  {judge.models.map((model) => (
                    <NativeSelectOption key={model} value={model}>
                      {model}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  <Trans>The model that compares each answer with the expected output.</Trans>
                </FieldDescription>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="judgeInstructions"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={judgeInstructionsId}>
                  <Trans>Instructions for the judge (optional)</Trans>
                </FieldLabel>
                <Textarea
                  {...field}
                  id={judgeInstructionsId}
                  maxLength={CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH}
                  placeholder={t`e.g. Accept an answer that gives the right fact, whatever its wording.`}
                  className="max-h-40"
                  aria-invalid={fieldState.invalid}
                />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="scope"
            render={({ field }) => (
              <Field>
                <FieldLabel>
                  <Trans comment="How much of a dataset an evaluation asks">Records to ask</Trans>
                </FieldLabel>
                <RadioGroup
                  value={field.value}
                  onValueChange={(value) => field.onChange(value === "limited" ? "limited" : "all")}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id={allRecordsId} value="all" />
                    <Label htmlFor={allRecordsId} className="font-normal">
                      <Plural
                        value={recordCount}
                        one="The # record of the dataset"
                        other="All # records of the dataset"
                      />
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id={firstRecordsId} value="limited" />
                    <Label htmlFor={firstRecordsId} className="font-normal">
                      <Trans>Only the first ones, to try</Trans>
                    </Label>
                  </div>
                </RadioGroup>
              </Field>
            )}
          />
          {scope === "limited" ? (
            <Controller
              control={form.control}
              name="limitedCount"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={limitedCountId}>
                    <Trans>How many records</Trans>
                  </FieldLabel>
                  <Input
                    id={limitedCountId}
                    type="number"
                    min={1}
                    max={recordCount}
                    className="w-28"
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError>
                      <Trans>Give a number of records, 1 or more.</Trans>
                    </FieldError>
                  ) : null}
                </Field>
              )}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={!canRun || startRun.isPending}>
              <PlayIcon data-icon="inline-start" aria-hidden />
              <Trans comment="Starts an evaluation">Run</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
