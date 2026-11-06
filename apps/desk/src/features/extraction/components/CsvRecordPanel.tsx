import type { CsvColumnDto, CsvExtractionRecordOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { SidePanel } from "@/components/shared/SidePanel"
import { fileValueOf } from "../csv-records"
import { extractedFieldsOf } from "../extraction-fields"
import { FieldValue } from "./FieldValue"
import { RecordStatusIcon } from "./RecordStatusIcon"
import { ResultFields } from "./ResultFields"

export type CsvRecordPanelProps = {
  record: CsvExtractionRecordOutputDto
  fileColumns: CsvColumnDto[]
  onClose: () => void
}

/** One row of a CSV run in full, beside the table: the agent's answers, then the file's values. */
export function CsvRecordPanel({ record, fileColumns, onClose }: CsvRecordPanelProps) {
  const { t } = useLingui()
  const rowNumber = record.rowIndex + 1
  const fields = extractedFieldsOf(record.agentRawOutput ?? {})
  return (
    <SidePanel title={t`Row ${rowNumber}`} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="flex items-center gap-2 text-muted-foreground">
          <RecordStatusIcon record={record} />
          {record.status === "error" ? (
            <Trans>The agent could not answer for this row.</Trans>
          ) : null}
        </p>
        {record.errorDetails ? (
          <pre className="rounded-lg bg-muted p-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
            {record.errorDetails}
          </pre>
        ) : null}
        {fields.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">
              <Trans>Agent's answers</Trans>
            </h3>
            <ResultFields fields={fields} />
          </section>
        ) : null}
        {fileColumns.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">
              <Trans>From the file</Trans>
            </h3>
            <dl className="flex flex-col divide-y rounded-2xl border">
              {fileColumns.map((column) => (
                <div key={column.id} className="grid gap-1 px-4 py-3">
                  <dt className="text-muted-foreground">{column.finalName}</dt>
                  <dd className="min-w-0">
                    <FieldValue value={fileValueOf(record.inputData, column.id)} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
    </SidePanel>
  )
}
