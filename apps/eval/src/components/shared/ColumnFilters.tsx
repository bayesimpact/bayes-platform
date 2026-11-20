import { Trans, useLingui } from "@lingui/react/macro"
import { SearchIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

export type ColumnFiltersProps = {
  /** The columns the API can look in, each with the name the person reads. */
  columns: { id: string; label: string }[]
  /** The filters that apply: the text each column must hold, by the column's id. */
  filters: Record<string, string>
  /** Sets the text a column must hold, or takes its filter away with an empty text. */
  onFilter: (column: string, text: string) => void
}

/**
 * The filters of a table the API pages: a column, and the text it must hold. Each filter applies
 * when the person asks for it, with Enter or the button, as it is a request to the API, and
 * several columns filter at once. The filters that apply show under the field, each with the way
 * to take it away.
 */
export function ColumnFilters({ columns, filters, onFilter }: ColumnFiltersProps) {
  const { t } = useLingui()
  const [firstColumn] = columns
  const [column, setColumn] = useState(firstColumn?.id ?? "")
  const [text, setText] = useState("")
  if (!firstColumn) return null
  const applied = columns.flatMap((candidate) => {
    const filterText = filters[candidate.id]
    return filterText ? [{ ...candidate, text: filterText }] : []
  })
  return (
    <search className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (text.trim() === "") return
          onFilter(column, text.trim())
          setText("")
        }}
      >
        {/* The select fills its frame: the frame gives it its width. */}
        <div className="w-full sm:w-48">
          <NativeSelect
            aria-label={t`Column to filter`}
            value={column}
            onChange={(event) => setColumn(event.target.value)}
          >
            {columns.map((candidate) => (
              <NativeSelectOption key={candidate.id} value={candidate.id}>
                {candidate.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t`Text the column holds`}
            aria-label={t`Text the column holds`}
          />
        </InputGroup>
        <Button type="submit" variant="outline">
          <Trans comment="The button that adds a filter to a table: a column and the text it holds">
            Filter
          </Trans>
        </Button>
      </form>
      {applied.length > 0 ? (
        <ul aria-label={t`Filters that apply`} className="flex flex-wrap items-center gap-1.5">
          {applied.map((filter) => {
            const columnName = filter.label
            const filterText = filter.text
            return (
              <li key={filter.id}>
                <Badge variant="secondary" className="gap-1 pr-1">
                  <Trans comment="A filter of a table: a column and the text it must hold">
                    {columnName}: {filterText}
                  </Trans>
                  <button
                    type="button"
                    aria-label={t`Remove the filter on ${columnName}`}
                    onClick={() => onFilter(filter.id, "")}
                    className="rounded-full p-0.5 outline-none hover:bg-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <XIcon aria-hidden className="size-3" />
                  </button>
                </Badge>
              </li>
            )
          })}
        </ul>
      ) : null}
    </search>
  )
}
