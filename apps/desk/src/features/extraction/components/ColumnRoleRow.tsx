import type { CsvColumnRoleDto, CsvFileColumnOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { sampleOf } from "../csv-setup"

export type ColumnRoleRowProps = {
  column: CsvFileColumnOutputDto
  role: CsvColumnRoleDto
  onRoleChange: (role: CsvColumnRoleDto) => void
}

/** A column of the CSV file, with its first values and what the agent does with it. */
export function ColumnRoleRow({ column, role, onRoleChange }: ColumnRoleRowProps) {
  const { t } = useLingui()
  const sample = sampleOf(column.values)
  const name = column.name
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className={cn("flex min-w-0 flex-1 flex-col", role === "ignore" && "opacity-60")}>
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {sample === "" ? <Trans>No values in the first rows</Trans> : sample}
        </span>
      </div>
      <ToggleGroup
        aria-label={t`What the agent does with ${name}`}
        variant="outline"
        size="sm"
        spacing={0}
        value={[role]}
        // A toggle group lets every item go: the role stays when the person clicks it again.
        onValueChange={(values) => {
          const [next] = values
          if (next === "input" || next === "reference" || next === "ignore") onRoleChange(next)
        }}
      >
        <ToggleGroupItem value="input">
          <Trans comment="The agent reads this column">Read</Trans>
        </ToggleGroupItem>
        <ToggleGroupItem value="reference">
          <Trans comment="The column shows beside the results, unread">Keep</Trans>
        </ToggleGroupItem>
        <ToggleGroupItem value="ignore">
          <Trans comment="The column is left out">Skip</Trans>
        </ToggleGroupItem>
      </ToggleGroup>
    </li>
  )
}
