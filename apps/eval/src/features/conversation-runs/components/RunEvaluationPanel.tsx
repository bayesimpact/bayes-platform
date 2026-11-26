import { Button } from "@caseai-connect/app-ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@caseai-connect/app-ui/components/field"
import { NativeSelect, NativeSelectOption } from "@caseai-connect/app-ui/components/native-select"
import { Textarea } from "@caseai-connect/app-ui/components/textarea"
import {
  type AgentParamsDto,
  CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH,
  type ConversationDatasetOutputDto,
} from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { PlayIcon } from "lucide-react"
import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { AgentVersionPicker } from "@/components/shared/AgentVersionPicker"
import { RunScopeField } from "@/components/shared/RunScopeField"
import { SidePanel } from "@/components/shared/SidePanel"
import type { EvaluationAgent } from "@/features/agents"
import { agentVersionsQueryOptions } from "@/features/agents"
import { useStartConversationRun } from "../api/mutations"
import { judgeModelsQueryOptions } from "../api/queries"
import { conversationRunFormSchema } from "../schemas"

export type RunEvaluationPanelProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  dataset: ConversationDatasetOutputDto
  onClose: () => void
}

/**
 * The side panel of a dataset's page that starts an evaluation of the agent over it: a saved version of the agent
 * answers the dataset's records, and a judge model grades each answer. Once started, the run's
 * page opens.
 */
export function RunEvaluationPanel({
  agent,
  agentParams,
  dataset,
  onClose,
}: RunEvaluationPanelProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const formId = useId()
  const judgeModelId = useId()
  const judgeInstructionsId = useId()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const { data: judge } = useSuspenseQuery(judgeModelsQueryOptions(agentParams))
  const startRun = useStartConversationRun(agentParams)
  // The version in production first: it is the one the agent's users talk to.
  const defaultVersion = versions.find((version) => version.isProduction) ?? versions[0]
  const form = useForm({
    resolver: zodResolver(conversationRunFormSchema),
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
  const agentName = agent.name
  const datasetName = dataset.name
  const recordCount = dataset.recordCount
  const canStart = judge.models.length > 0
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
    <SidePanel
      title={<Trans>Run an evaluation</Trans>}
      description={
        <Trans>
          {agentName} answers the records of {datasetName}, and a judge model grades each answer
          against the expected output.
        </Trans>
      }
      onClose={onClose}
      takesFocus
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="submit" form={formId} disabled={!canStart || startRun.isPending}>
            <PlayIcon data-icon="inline-start" aria-hidden />
            <Trans comment="Starts an evaluation">Run</Trans>
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-6"
        noValidate
      >
        <Controller
          control={form.control}
          name="versionId"
          render={({ field, fieldState }) => (
            <AgentVersionPicker
              versions={versions}
              agentName={agentName}
              selectedId={field.value}
              onSelect={field.onChange}
              description={<Trans>A run evaluates a saved version, never the draft.</Trans>}
              selectedNote={<Trans>The evaluation uses this version</Trans>}
              error={
                fieldState.invalid ? (
                  <Trans>Choose the version the evaluation uses.</Trans>
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
              {canStart ? (
                <FieldDescription>
                  <Trans>The model that compares each answer with the expected output.</Trans>
                </FieldDescription>
              ) : (
                <FieldError>
                  <Trans>
                    No model of this project can judge an evaluation. Ask an admin of the project to
                    make one available.
                  </Trans>
                </FieldError>
              )}
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
        <Controller
          control={form.control}
          name="scope"
          render={({ field: scopeField }) => (
            <Controller
              control={form.control}
              name="limitedCount"
              render={({ field: countField, fieldState }) => (
                <RunScopeField
                  recordCount={recordCount}
                  scope={scopeField.value}
                  onScopeChange={scopeField.onChange}
                  limitedCount={countField.value}
                  onLimitedCountChange={countField.onChange}
                  isLimitedCountInvalid={fieldState.invalid}
                />
              )}
            />
          )}
        />
      </form>
    </SidePanel>
  )
}
