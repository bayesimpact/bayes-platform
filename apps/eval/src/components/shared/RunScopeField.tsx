import { Plural, Trans } from "@lingui/react/macro"
import { useId } from "react"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

/** How much of a dataset an evaluation asks: all its records, or the first ones only. */
type RunScope = "all" | "limited"

/**
 * Whether a form's scope can start an evaluation: the count only matters, and must be a whole
 * number of records, when the evaluation asks the first ones.
 */
export const isRunScopeValid = ({
  scope,
  limitedCount,
}: {
  scope: RunScope
  limitedCount: number
}) => scope === "all" || (Number.isInteger(limitedCount) && limitedCount >= 1)

export type RunScopeFieldProps = {
  /** How many records the dataset holds. */
  recordCount: number
  scope: RunScope
  onScopeChange: (scope: RunScope) => void
  /** How many records a limited evaluation asks: `NaN` while the field is empty. */
  limitedCount: number
  onLimitedCountChange: (count: number) => void
  /** Whether the count is not a number of records the evaluation can ask. */
  isLimitedCountInvalid: boolean
}

/**
 * The part of the form that starts an evaluation which says how many records it asks: the whole
 * dataset, or its first records, to try.
 */
export function RunScopeField({
  recordCount,
  scope,
  onScopeChange,
  limitedCount,
  onLimitedCountChange,
  isLimitedCountInvalid,
}: RunScopeFieldProps) {
  const allRecordsId = useId()
  const firstRecordsId = useId()
  const limitedCountId = useId()
  return (
    <>
      <Field>
        <FieldLabel>
          <Trans comment="How much of a dataset an evaluation asks">Records to ask</Trans>
        </FieldLabel>
        <RadioGroup
          value={scope}
          onValueChange={(value) => onScopeChange(value === "limited" ? "limited" : "all")}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem id={allRecordsId} value="all" />
            <Label htmlFor={allRecordsId} className="font-normal">
              <Plural
                value={recordCount}
                one="The # record of the dataset"
                other="All # records of the dataset"
              />
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id={firstRecordsId} value="limited" />
            <Label htmlFor={firstRecordsId} className="font-normal">
              <Trans>Only the first ones, to try</Trans>
            </Label>
          </div>
        </RadioGroup>
      </Field>
      {scope === "limited" ? (
        <Field data-invalid={isLimitedCountInvalid}>
          <FieldLabel htmlFor={limitedCountId}>
            <Trans>How many records</Trans>
          </FieldLabel>
          <Input
            id={limitedCountId}
            type="number"
            min={1}
            max={recordCount}
            className="w-28"
            value={Number.isNaN(limitedCount) ? "" : limitedCount}
            // No more than the dataset holds: a higher number would ask them all anyway.
            onChange={(event) =>
              onLimitedCountChange(Math.min(event.target.valueAsNumber, Math.max(1, recordCount)))
            }
            aria-invalid={isLimitedCountInvalid}
          />
          {isLimitedCountInvalid ? (
            <FieldError>
              <Trans>Give a number of records, 1 or more.</Trans>
            </FieldError>
          ) : null}
        </Field>
      ) : null}
    </>
  )
}
