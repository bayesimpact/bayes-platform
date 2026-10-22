import { Trans, useLingui } from "@lingui/react/macro"
import { CheckIcon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { isRecord } from "@/lib/is-record"
import { extractedFieldsOf, isEmptyValue } from "../extraction-fields"

export type FieldValueProps = {
  value: unknown
  /** A table cell shows a value on two lines at most. */
  isCompact?: boolean
}

/**
 * A value the agent filled in, as it reads best: text as written, a number in the person's
 * language, yes or no, a list as tags, an object as its own fields. A value the agent did not
 * find says so.
 */
export function FieldValue({ value, isCompact = false }: FieldValueProps) {
  const { i18n } = useLingui()
  if (isEmptyValue(value)) {
    return (
      <span className="text-muted-foreground italic">
        <Trans comment="A field of the document the agent found no value for">Not found</Trans>
      </span>
    )
  }
  if (typeof value === "string") {
    return (
      <span className={isCompact ? "line-clamp-2 break-words" : "break-words whitespace-pre-wrap"}>
        {value}
      </span>
    )
  }
  if (typeof value === "number") {
    return <span className="tabular-nums">{new Intl.NumberFormat(i18n.locale).format(value)}</span>
  }
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center gap-1">
        <CheckIcon aria-hidden className="size-4 text-muted-foreground" />
        <Trans>Yes</Trans>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1">
        <XIcon aria-hidden className="size-4 text-muted-foreground" />
        <Trans>No</Trans>
      </span>
    )
  }
  if (Array.isArray(value)) {
    const isFlat = value.every((item) => typeof item !== "object" || item === null)
    if (isFlat && !isCompact) {
      return (
        <span className="flex flex-wrap gap-1">
          {value.map((item, position) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the list holds plain values, which can repeat.
            <Badge key={position} variant="secondary" className="font-normal">
              {String(item)}
            </Badge>
          ))}
        </span>
      )
    }
    if (isFlat) return <span className="line-clamp-2">{value.map(String).join(", ")}</span>
    return (
      <ol className="flex flex-col gap-2">
        {value.map((item, position) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the items have no id of their own.
          <li key={position} className="border-l-2 pl-3">
            <FieldValue value={item} isCompact={isCompact} />
          </li>
        ))}
      </ol>
    )
  }
  if (isRecord(value)) {
    const fields = extractedFieldsOf(value)
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {fields.map((field) => (
          <div key={field.key} className="contents">
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="min-w-0">
              <FieldValue value={field.value} isCompact={isCompact} />
            </dd>
          </div>
        ))}
      </dl>
    )
  }
  return <span>{String(value)}</span>
}
