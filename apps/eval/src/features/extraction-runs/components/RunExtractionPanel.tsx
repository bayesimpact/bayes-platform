import { Button } from "@caseai-connect/app-ui/components/button"
import type { AgentParamsDto, ExtractionDatasetOutputDto } from "@caseai-connect/eval-contracts"
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
import { columnsOfRole } from "@/lib/extraction-columns"
import { useStartExtractionRun } from "../api/mutations"
import { defaultKeyMappingOf } from "../key-mapping"
import { extractionRunFormSchema } from "../schemas"
import { KeyMappingField } from "./KeyMappingField"

export type RunExtractionPanelProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  dataset: ExtractionDatasetOutputDto
  onClose: () => void
}

/**
 * The side panel of a dataset's page that starts an evaluation of an extraction agent over it: a saved version of
 * the agent reads each record, and each field it returns is compared with a target column. Once
 * started, the run's page opens.
 */
export function RunExtractionPanel({
  agent,
  agentParams,
  dataset,
  onClose,
}: RunExtractionPanelProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const formId = useId()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const startRun = useStartExtractionRun(agentParams)
  const targetColumns = columnsOfRole(dataset, "target")
  // The version in production first: it is the one the agent's users get.
  const defaultVersion = versions.find((version) => version.isProduction) ?? versions[0]
  const form = useForm({
    resolver: zodResolver(extractionRunFormSchema),
    defaultValues: {
      versionId: defaultVersion?.id ?? "",
      keyMapping: defaultVersion ? defaultKeyMappingOf(defaultVersion, targetColumns) : [],
      scope: "all" as const,
      limitedCount: 1,
    },
  })
  const agentName = agent.name
  const datasetName = dataset.name
  const handleSubmit = form.handleSubmit((values) => {
    const version = versions.find((candidate) => candidate.id === values.versionId)
    if (!version) return
    startRun.mutate(
      {
        agentId: agentParams.agentId,
        agentSettingsRevision: version.revision,
        evaluationExtractionDatasetId: dataset.id,
        keyMapping: values.keyMapping,
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
          {agentName} reads the records of {datasetName}, and each field it returns is compared with
          the value expected.
        </Trans>
      }
      onClose={onClose}
      takesFocus
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="submit" form={formId} disabled={startRun.isPending}>
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
              onSelect={(versionId) => {
                field.onChange(versionId)
                // Another version returns other fields: their mapping starts afresh.
                const version = versions.find((candidate) => candidate.id === versionId)
                form.setValue(
                  "keyMapping",
                  version ? defaultKeyMappingOf(version, targetColumns) : [],
                )
              }}
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
          name="keyMapping"
          render={({ field, fieldState }) => (
            <KeyMappingField
              mapping={field.value}
              onChange={field.onChange}
              targetColumns={targetColumns}
              error={
                !fieldState.invalid ? undefined : field.value.length === 0 ? (
                  <Trans>This version has no output schema: it returns no field to compare.</Trans>
                ) : (
                  <Trans>Give each compared field a column, or only show it.</Trans>
                )
              }
            />
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
                  recordCount={dataset.recordCount}
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
