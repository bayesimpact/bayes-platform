import type { AgentParamsDto } from "@bayes-platform/desk-contracts"
import { Trans } from "@lingui/react/macro"
import { Rows3Icon } from "lucide-react"
import { CsvFileUnusable } from "./CsvFileUnusable"

export type CsvFileWithoutRowsProps = {
  agent: AgentParamsDto
  fileName: string
}

/**
 * A CSV file with a header line and no data row: the agent runs once per row, so a run on it
 * would do nothing.
 */
export function CsvFileWithoutRows({ agent, fileName }: CsvFileWithoutRowsProps) {
  return (
    <CsvFileUnusable
      agent={agent}
      fileName={fileName}
      icon={<Rows3Icon aria-hidden />}
      title={<Trans>This file has no rows</Trans>}
    >
      <Trans>
        The agent runs once per row, and this file only has its header line. Add rows, then upload
        the file again.
      </Trans>
    </CsvFileUnusable>
  )
}
