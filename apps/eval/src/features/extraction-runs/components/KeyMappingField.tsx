import type {
  ExtractionDatasetColumnDto,
  ExtractionRunKeyMappingEntryDto,
} from "@bayes-platform/eval-contracts"
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
                // The field's name, then how it reads and its column: the form sits in a side panel.
                className="grid grid-cols-2 items-center gap-2 p-3"
              >
                <span className="col-span-2 truncate font-mono text-sm" title={field}>
                  {field}
                </span>
                <NativeSelect
                  aria-label={t`How the run reads the field ${field}`}
                  value={entry.mode}
                  onChange={(event) =>
                    change(field, { mode: event.target.value === "fyi" ? "fyi" : "scored" })
                  }
                >
                  <NativeSelectOption value="scored">
                    {t({
                      message: "Compared with",
                      comment:
                        "How a run reads a field of the agent: compared with a column, named next",
                    })}
                  </NativeSelectOption>
                  <NativeSelectOption value="fyi">
                    {t({
                      message: "Only shown",
                      comment:
                        "How a run reads a field of the agent: shown, and compared with nothing",
                    })}
                  </NativeSelectOption>
                </NativeSelect>
                {entry.mode === "scored" ? (
                  <NativeSelect
                    aria-label={t`Column the field ${field} is compared with`}
                    aria-invalid={error !== undefined && entry.datasetColumnId === ""}
                    value={entry.datasetColumnId}
                    onChange={(event) => change(field, { datasetColumnId: event.target.value })}
                  >
                    <NativeSelectOption value="">
                      {t({
                        message: "Choose a column…",
                        comment:
                          "The empty choice of the column a field of the agent is compared with",
                      })}
                    </NativeSelectOption>
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
