import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { Columns3Icon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FileKindIcon } from "./FileKindIcon"

export type CsvFileWithoutColumnsProps = {
  agent: AgentParamsDto
  fileName: string
}

/**
 * A CSV file with no header line names no column, so it has nothing to set up: the page says
 * what the file lacks, and leads to another file.
 */
export function CsvFileWithoutColumns({ agent, fileName }: CsvFileWithoutColumnsProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-10 pb-16">
      <header className="flex min-w-0 items-center gap-3">
        <FileKindIcon kind="csv" variant="tile" />
        <h1 className="truncate text-xl font-semibold tracking-tight">{fileName}</h1>
      </header>
      <Empty className="rounded-2xl border border-solid bg-background dark:bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Columns3Icon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>
            <Trans>This file has no columns</Trans>
          </EmptyTitle>
          <EmptyDescription>
            <Trans>
              A CSV file needs a first line that names its columns. Add one, then upload the file
              again.
            </Trans>
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link
            to="/o/$organizationId/p/$projectId/a/$agentId/extraction"
            params={agent}
            className={buttonVariants()}
          >
            <Trans>Choose another file</Trans>
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  )
}
