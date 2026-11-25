import type { AgentParamsDto } from "@bayes-platform/desk-contracts"
import { Trans } from "@lingui/react/macro"
import { Columns3Icon } from "lucide-react"
import { CsvFileUnusable } from "./CsvFileUnusable"

export type CsvFileWithoutColumnsProps = {
  agent: AgentParamsDto
  fileName: string
}

/** A CSV file with no header line names no column, so it has nothing to set up. */
export function CsvFileWithoutColumns({ agent, fileName }: CsvFileWithoutColumnsProps) {
  return (
    <CsvFileUnusable
      agent={agent}
      fileName={fileName}
      icon={<Columns3Icon aria-hidden />}
      title={<Trans>This file has no columns</Trans>}
    >
      <Trans>
        A CSV file needs a first line that names its columns. Add one, then upload the file again.
      </Trans>
    </CsvFileUnusable>
  )
}
