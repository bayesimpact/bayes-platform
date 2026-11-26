import { Button } from "@caseai-connect/app-ui/components/button"
import type {
  ExtractionDatasetOutputDto,
  ExtractionDatasetParamsDto,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { SectionCard } from "@/components/shared/SectionCard"
import { extractionFileColumnsQueryOptions } from "../api/queries"
import { ExtractionColumnsForm } from "./ExtractionColumnsForm"
import { ExtractionFilesSection } from "./ExtractionFilesSection"

export type ExtractionDatasetSetupProps = {
  dataset: ExtractionDatasetOutputDto
  datasetParams: ExtractionDatasetParamsDto
  /** Whether the person changes the dataset: only they build its records. */
  canEdit: boolean
}

/**
 * What builds the records of a dataset that has none yet, in two steps: choose one of the
 * project's CSV files, or upload one, then say what each of its columns is.
 */
export function ExtractionDatasetSetup({
  dataset,
  datasetParams,
  canEdit,
}: ExtractionDatasetSetupProps) {
  const [file, setFile] = useState<{ id: string; fileName: string } | null>(null)
  if (!canEdit) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <Trans>
          This dataset has no record yet. Who manages the datasets builds it from a CSV file.
        </Trans>
      </p>
    )
  }
  if (!file) {
    return (
      <ExtractionFilesSection
        project={datasetParams}
        onChoose={(chosen) => setFile({ id: chosen.id, fileName: chosen.fileName })}
      />
    )
  }
  return (
    <ChosenFileColumns
      dataset={dataset}
      datasetParams={datasetParams}
      file={file}
      onChooseAnother={() => setFile(null)}
    />
  )
}

type ChosenFileColumnsProps = {
  dataset: ExtractionDatasetOutputDto
  datasetParams: ExtractionDatasetParamsDto
  file: { id: string; fileName: string }
  onChooseAnother: () => void
}

/** The second step: the columns of the chosen file, once the API read them. */
function ChosenFileColumns({
  dataset,
  datasetParams,
  file,
  onChooseAnother,
}: ChosenFileColumnsProps) {
  // useQuery: a conditional read, which starts once the person chose a file. The step shows its
  // own loading and its own error, with the way to choose another file.
  const columns = useQuery(extractionFileColumnsQueryOptions(datasetParams, file.id))
  const fileName = file.fileName
  if (columns.data) {
    return (
      <ExtractionColumnsForm
        // A new form per file: its fields start from the file's columns.
        key={file.id}
        dataset={dataset}
        datasetParams={datasetParams}
        file={file}
        fileColumns={columns.data}
        onChooseAnother={onChooseAnother}
      />
    )
  }
  return (
    <SectionCard title={<Trans>Columns of {fileName}</Trans>}>
      <p className="text-sm text-muted-foreground" role={columns.isError ? "alert" : "status"}>
        {columns.isError ? (
          <Trans>The file could not be read. Choose another file, or try again.</Trans>
        ) : (
          <Trans>Reading the file…</Trans>
        )}
      </p>
      {columns.isError ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onChooseAnother}>
            <Trans>Choose another file</Trans>
          </Button>
          <Button variant="outline" onClick={() => void columns.refetch()}>
            <Trans comment="Reads again a file whose columns could not be read">Try again</Trans>
          </Button>
        </div>
      ) : null}
    </SectionCard>
  )
}
