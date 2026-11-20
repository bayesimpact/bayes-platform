import type {
  ExtractionDatasetColumnDto,
  ExtractionRunKeyMappingEntryDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

export type KeyMappingFieldProps = {
  /** How the run reads each field the agent returns. */
  mapping: ExtractionRunKeyMappingEntryDto[]
  onChange: (mapping: ExtractionRunKeyMappingEntryDto[]) => void
  /** The target columns of the dataset, which a field is compared with. */
  targetColumns: ExtractionDatasetColumnDto[]
  /** What is missing, once the person tried to start the run. */
  error?: ReactNode
}

/**
 * The part of the form that starts an extraction run which says how each field the agent returns
 * reads: compared with a target column of the dataset, or only shown beside the results.
 */
export function KeyMappingField({ mapping, onChange, targetColumns, error }: KeyMappingFieldProps) {
  const { t } = useLingui()
  const change = (agentOutputKey: string, changes: Partial<ExtractionRunKeyMappingEntryDto>) =>
    onChange(
      mapping.map((entry) =>
        entry.agentOutputKey === agentOutputKey ? { ...entry, ...changes } : entry,
      ),
    )
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel>
        <Trans comment="The part of a run's form that pairs the agent's fields with the dataset's columns">
          Fields to compare
        </Trans>
      </FieldLabel>
      <FieldDescription>
        <Trans>
          Each field the agent returns is compared with a target column of the dataset, or only
          shown beside the results.
        </Trans>
      </FieldDescription>
      {mapping.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Trans>This version returns no field: it has no output schema.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {mapping.map((entry) => {
            const field = entry.agentOutputKey
            return (
              <li
                key={field}
                className="grid grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
              >
                <span className="truncate font-mono text-sm" title={field}>
                  {field}
                </span>
                <NativeSelect
                  aria-label={t`How the run reads the field ${field}`}
                  value={entry.mode}
                  onChange={(event) =>
                    change(field, { mode: event.target.value === "fyi" ? "fyi" : "scored" })
                  }
                >
                  <NativeSelectOption value="scored">{t`Compared with`}</NativeSelectOption>
                  <NativeSelectOption value="fyi">{t`Only shown`}</NativeSelectOption>
                </NativeSelect>
                {entry.mode === "scored" ? (
                  <NativeSelect
                    aria-label={t`Column the field ${field} is compared with`}
                    aria-invalid={error !== undefined && entry.datasetColumnId === ""}
                    value={entry.datasetColumnId}
                    onChange={(event) => change(field, { datasetColumnId: event.target.value })}
                  >
                    <NativeSelectOption value="">{t`Choose a column…`}</NativeSelectOption>
                    {targetColumns.map((column) => (
                      <NativeSelectOption key={column.id} value={column.id}>
                        {column.finalName}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    <Trans>Not compared</Trans>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
