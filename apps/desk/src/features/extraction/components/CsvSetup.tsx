import type { AgentParamsDto, CsvColumnRoleDto } from "@caseai-connect/desk-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { PlayIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { extractionDocumentsQueryOptions } from "@/features/history"
import { useStartCsvExtraction } from "../api/mutations"
import { csvColumnsQueryOptions } from "../api/queries"
import {
  type ColumnRoles,
  initialColumnRoles,
  type RowScope,
  readsAColumn,
  toColumnSchema,
} from "../csv-setup"
import { ColumnRoleRow } from "./ColumnRoleRow"
import { CsvRowScope } from "./CsvRowScope"
import { FileKindIcon } from "./FileKindIcon"

export type CsvSetupProps = {
  agent: AgentParamsDto
  documentId: string
}

/**
 * Before a CSV file runs: what the agent reads in each row, and on how many rows, so the person
 * can try a few rows first.
 */
export function CsvSetup({ agent, documentId }: CsvSetupProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const columnsHeadingId = useId()
  const { data: columns } = useSuspenseQuery(csvColumnsQueryOptions(agent, documentId))
  const { data: documents } = useSuspenseQuery(extractionDocumentsQueryOptions(agent))
  const [setup, setSetup] = useState<{ roles: ColumnRoles; scope: RowScope }>(() => ({
    roles: initialColumnRoles(columns),
    scope: { kind: "all" },
  }))
  const startExtraction = useStartCsvExtraction(agent)
  const fileName = documents.find((document) => document.id === documentId)?.fileName ?? t`CSV file`
  const canStart = readsAColumn(setup.roles) && !startExtraction.isPending
  const rowCount = setup.scope.kind === "first" ? setup.scope.count : 0

  const setAllRoles = (role: CsvColumnRoleDto) =>
    setSetup((current) => ({
      ...current,
      roles: Object.fromEntries(columns.map((column) => [column.id, role])),
    }))

  const setRole = (columnId: string, role: CsvColumnRoleDto) =>
    setSetup((current) => ({ ...current, roles: { ...current.roles, [columnId]: role } }))

  const handleStart = () =>
    startExtraction.mutate(
      {
        csvDocumentId: documentId,
        columnSchema: toColumnSchema(columns, setup.roles),
        recordLimit: setup.scope.kind === "all" ? null : setup.scope.count,
      },
      {
        onSuccess: (run) =>
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId",
            params: { ...agent, csvRunId: run.id },
          }),
        onError: () => toast.error(t`The extraction could not start. Try again.`),
      },
    )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-10 pb-16">
      <header className="flex min-w-0 items-center gap-3">
        <FileKindIcon kind="csv" variant="tile" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{fileName}</h1>
          <p className="text-sm text-muted-foreground">
            <Trans>The agent runs once per row. Choose what it reads in each one.</Trans>
          </p>
        </div>
      </header>

      <section aria-labelledby={columnsHeadingId} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
          <h2 id={columnsHeadingId} className="text-sm font-medium">
            <Trans>Columns</Trans>
          </h2>
          <div className="flex items-center gap-1 text-xs">
            <Button
              variant="link"
              size="xs"
              className="h-auto px-1"
              onClick={() => setAllRoles("input")}
            >
              <Trans>Read all</Trans>
            </Button>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <Button
              variant="link"
              size="xs"
              className="h-auto px-1"
              onClick={() => setAllRoles("ignore")}
            >
              <Trans>Skip all</Trans>
            </Button>
          </div>
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          <Trans>
            <strong className="font-medium text-foreground">Read</strong>: the agent reads it.{" "}
            <strong className="font-medium text-foreground">Keep</strong>: shown beside the results.{" "}
            <strong className="font-medium text-foreground">Skip</strong>: left out.
          </Trans>
        </p>
        <ul className="flex flex-col divide-y rounded-2xl border bg-background dark:bg-card">
          {columns.map((column) => (
            <ColumnRoleRow
              key={column.id}
              column={column}
              role={setup.roles[column.id] ?? "input"}
              onRoleChange={(role) => setRole(column.id, role)}
            />
          ))}
        </ul>
      </section>

      <CsvRowScope
        scope={setup.scope}
        onScopeChange={(scope) => setSetup((current) => ({ ...current, scope }))}
      />

      <footer className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {readsAColumn(setup.roles) ? null : (
          <output className="text-sm text-muted-foreground sm:mr-auto">
            <Trans>Choose at least one column for the agent to read.</Trans>
          </output>
        )}
        <Link
          to="/o/$organizationId/p/$projectId/a/$agentId/extraction"
          params={agent}
          className={buttonVariants({ variant: "ghost" })}
        >
          <Trans>Cancel</Trans>
        </Link>
        <Button onClick={handleStart} disabled={!canStart}>
          <PlayIcon data-icon="inline-start" aria-hidden />
          {setup.scope.kind === "all" ? (
            <Trans>Extract every row</Trans>
          ) : (
            <Plural value={rowCount} one="Extract the first row" other="Extract the first # rows" />
          )}
        </Button>
      </footer>
    </div>
  )
}
