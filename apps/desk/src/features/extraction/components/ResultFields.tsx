import { useLingui } from "@lingui/react/macro"
import { CopyButton } from "@/components/shared/CopyButton"
import { type ExtractedField, plainTextOf } from "../extraction-fields"
import { FieldValue } from "./FieldValue"

export type ResultFieldsProps = {
  fields: ExtractedField[]
}

/**
 * The fields the agent filled in, one per line: its name on the left, its value on the right, or
 * under it on a phone. Each value copies on its own.
 */
export function ResultFields({ fields }: ResultFieldsProps) {
  const { t } = useLingui()
  return (
    <dl className="flex flex-col divide-y rounded-2xl border bg-background dark:bg-card">
      {fields.map((field) => {
        const label = field.label
        return (
          <div
            key={field.key}
            className="group/field relative grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(8rem,1fr)_2fr] sm:gap-4"
          >
            <dt className="font-medium text-muted-foreground" title={field.key}>
              {label}
            </dt>
            <dd className="min-w-0 pr-8">
              <FieldValue value={field.value} />
            </dd>
            <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/field:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
              <CopyButton text={plainTextOf(field.value)} label={t`Copy ${label}`} />
            </div>
          </div>
        )
      })}
    </dl>
  )
}
