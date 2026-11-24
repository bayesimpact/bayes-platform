import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { CsvFileHeader } from "./CsvFileHeader"

export type CsvFileUnusableProps = {
  agent: AgentParamsDto
  fileName: string
  /** The icon of what the file lacks. */
  icon: ReactNode
  /** What the file lacks, in a few words. */
  title: ReactNode
  /** Why the agent cannot run on the file, and what to do. */
  children: ReactNode
}

/**
 * The setup page of a CSV file the agent cannot run on: the page says what the file lacks, and
 * leads to another file.
 */
export function CsvFileUnusable({ agent, fileName, icon, title, children }: CsvFileUnusableProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-10 pb-16">
      <CsvFileHeader fileName={fileName} />
      <Empty className="rounded-2xl border border-solid bg-background dark:bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{children}</EmptyDescription>
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
