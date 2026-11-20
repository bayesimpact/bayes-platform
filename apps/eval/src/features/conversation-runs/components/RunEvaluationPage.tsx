import {
  type AgentParamsDto,
  CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH,
  type ConversationDatasetOutputDto,
} from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { PlayIcon } from "lucide-react"
import { useId } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { BackLink } from "@/components/shared/BackLink"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { isRunScopeValid, RunScopeField } from "@/components/shared/RunScopeField"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { EvaluationAgent } from "@/features/agents"
import { AgentVersionPicker, agentVersionsQueryOptions } from "@/features/campaigns"
import { useStartConversationRun } from "../api/mutations"
import { judgeModelsQueryOptions } from "../api/queries"

/** What the dialog asks: the version to evaluate, the judge, and how much of the dataset to ask. */
const runFormSchema = z
  .object({
    versionId: z.uuid(),
    judgeModel: z.string().min(1),
    judgeInstructions: z.string().max(CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH),
    scope: z.enum(["all", "limited"]),
    // `NaN` while its field is empty: it only counts for an evaluation of the first records.
    limitedCount: z.number(),
  })
  .refine(isRunScopeValid, { path: ["limitedCount"] })

export type RunEvaluationPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  dataset: ConversationDatasetOutputDto
}

/**
 * The page that starts an evaluation of the agent over a dataset: a saved version of the agent
 * answers the dataset's records, and a judge model grades each answer. Once started, the run's
 * page opens.
 */
export function RunEvaluationPage({ agent, agentParams, dataset }: RunEvaluationPageProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const datasetPage = {
    to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
    params: { ...agentParams, datasetId: dataset.id },
  } as const
  const judgeModelId = useId()
  const judgeInstructionsId = useId()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const { data: judge } = useSuspenseQuery(judgeModelsQueryOptions(agentParams))
  const startRun = useStartConversationRun(agentParams)
  // The version in production first: it is the one the agent's users talk to.
  const defaultVersion = versions.find((version) => version.isProduction) ?? versions[0]
  const form = useForm({
    resolver: zodResolver(runFormSchema),
    defaultValues: {
      versionId: defaultVersion?.id ?? "",
      judgeModel: judge.models.some((model) => model.model === judge.defaultModel)
        ? judge.defaultModel
        : (judge.models[0]?.model ?? ""),
      judgeInstructions: "",
      scope: "all" as const,
      limitedCount: 1,
    },
  })
  const scope = useWatch({ control: form.control, name: "scope" })
  const limitedCount = useWatch({ control: form.control, name: "limitedCount" })
  const agentName = agent.name
  const datasetName = dataset.name
  const recordCount = dataset.recordCount
  const canRun = versions.length > 0 && judge.models.length > 0
  const handleSubmit = form.handleSubmit((values) => {
    const version = versions.find((candidate) => candidate.id === values.versionId)
    if (!version) return
    startRun.mutate(
      {
        agentId: agentParams.agentId,
        agentSettingsRevision: version.revision,
        datasetId: dataset.id,
        judgeModel: values.judgeModel,
        judgeInstructions: values.judgeInstructions.trim() || null,
        recordLimit: values.scope === "limited" ? values.limitedCount : null,
      },
      {
        onSuccess: (run) => {
          toast.success(t`The evaluation started.`)
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId",
            params: { ...agentParams, datasetId: dataset.id, runId: run.id },
          })
        },
        onError: () => toast.error(t`The evaluation could not start. Try again.`),
      },
    )
  })
  return (
    <PageContainer>
      <PageHeader
        back={<BackLink {...datasetPage}>{datasetName}</BackLink>}
        title={<Trans>Run an evaluation</Trans>}
        description={
          <Trans>
            {agentName} answers the records of {datasetName}, and a judge model grades each answer
            against the expected output.
          </Trans>
        }
      />
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex max-w-2xl flex-col gap-6 rounded-lg border bg-background p-4 md:p-6 dark:bg-card"
        noValidate
      >
        <Controller
          control={form.control}
          name="versionId"
          render={({ field, fieldState }) => (
            <AgentVersionPicker
              agentParams={agentParams}
              agentName={agentName}
              selectedId={field.value}
              onSelect={field.onChange}
              description={<Trans>A run evaluates a saved version, never the draft.</Trans>}
              selectedNote={<Trans>The evaluation asks this version</Trans>}
              error={
                fieldState.invalid ? (
                  <Trans>Choose the version the evaluation asks.</Trans>
                ) : undefined
              }
            />
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
                {judge.models.map((model) => {
                  const name = model.model
                  return (
                    <NativeSelectOption key={name} value={name}>
                      {model.deprecation && model.servedOutsideEu
                        ? t`${name} (deprecated, non-EU)`
                        : model.deprecation
                          ? t`${name} (deprecated)`
                          : model.servedOutsideEu
                            ? t`${name} (non-EU)`
                            : name}
                    </NativeSelectOption>
                  )
                })}
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
                placeholder={t`e.g. Penalize answers that are not in the expected language`}
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                <Trans>What the judge is told, on top of the expected output.</Trans>
              </FieldDescription>
            </Field>
          )}
        />
        <RunScopeField
          recordCount={recordCount}
          scope={scope}
          onScopeChange={(next) => form.setValue("scope", next)}
          limitedCount={limitedCount}
          onLimitedCountChange={(count) =>
            form.setValue("limitedCount", count, { shouldValidate: form.formState.isSubmitted })
          }
          isLimitedCountInvalid={form.formState.errors.limitedCount !== undefined}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Link {...datasetPage} className={cn(buttonVariants({ variant: "outline" }))}>
            <Trans>Cancel</Trans>
          </Link>
          <Button type="submit" disabled={!canRun || startRun.isPending}>
            <PlayIcon data-icon="inline-start" aria-hidden />
            <Trans comment="Starts an evaluation">Run</Trans>
          </Button>
        </div>
      </form>
    </PageContainer>
  )
}
