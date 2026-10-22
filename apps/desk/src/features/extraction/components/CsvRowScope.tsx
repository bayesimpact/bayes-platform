import { Trans, useLingui } from "@lingui/react/macro"
import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { RowScope } from "../csv-setup"

/** The rows a try reads by default: enough to judge, few enough to wait little. */
const DEFAULT_TRY_COUNT = 10

export type CsvRowScopeProps = {
  scope: RowScope
  onScopeChange: (scope: RowScope) => void
}

/** Whether the run reads every row, or the first ones only. */
export function CsvRowScope({ scope, onScopeChange }: CsvRowScopeProps) {
  const { t } = useLingui()
  const allId = useId()
  const firstId = useId()
  const headingId = useId()
  const count = scope.kind === "first" ? scope.count : DEFAULT_TRY_COUNT

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="px-1 text-sm font-medium">
        <Trans>Rows</Trans>
      </h2>
      <RadioGroup
        value={scope.kind}
        onValueChange={(value) =>
          onScopeChange(value === "first" ? { kind: "first", count } : { kind: "all" })
        }
        className="flex flex-col gap-0 divide-y rounded-2xl border bg-background dark:bg-card"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <RadioGroupItem id={allId} value="all" />
          <Label htmlFor={allId} className="font-normal">
            <Trans>Every row of the file</Trans>
          </Label>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <RadioGroupItem id={firstId} value="first" />
          <Label htmlFor={firstId} className="font-normal">
            <Trans>The first rows only, to try the setup</Trans>
          </Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={count}
            aria-label={t`Number of rows to try`}
            // Going to the number chooses the first rows: nothing else uses it.
            onFocus={() => onScopeChange({ kind: "first", count })}
            onChange={(event) => {
              const next = Math.max(1, Math.floor(Number(event.target.value) || 1))
              onScopeChange({ kind: "first", count: next })
            }}
            className="ml-auto h-8 w-20 tabular-nums"
          />
        </div>
      </RadioGroup>
    </section>
  )
}
