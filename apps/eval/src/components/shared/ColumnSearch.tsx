import { Trans, useLingui } from "@lingui/react/macro"
import { SearchIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

export type ColumnSearchProps = {
  /** The columns the API can look in, each with the name the person reads. */
  columns: { id: string; label: string }[]
  /** The search that applies: its column, and its text, empty for none. */
  value: { column: string | undefined; text: string }
  /** Applies a search, or none when the text is empty. */
  onSearch: (search: { column: string; text: string }) => void
}

/**
 * The search of a table the API pages: a column to look in, and a text. It applies when the
 * person asks for it, with Enter or the button, as each search is a request to the API. Emptying
 * the field takes the search away at once.
 */
export function ColumnSearch({ columns, value, onSearch }: ColumnSearchProps) {
  const { t } = useLingui()
  const [firstColumn] = columns
  const [column, setColumn] = useState(value.column ?? firstColumn?.id ?? "")
  const [text, setText] = useState(value.text)
  if (!firstColumn) return null
  return (
    <search>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSearch({ column, text: text.trim() })
        }}
      >
        {/* The select fills its frame: the frame gives it its width. */}
        <div className="w-full sm:w-48">
          <NativeSelect
            aria-label={t`Column to search in`}
            value={column}
            onChange={(event) => {
              setColumn(event.target.value)
              // A search under way moves to the new column.
              if (value.text !== "") onSearch({ column: event.target.value, text: text.trim() })
            }}
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
            onChange={(event) => {
              setText(event.target.value)
              if (event.target.value === "" && value.text !== "") onSearch({ column, text: "" })
            }}
            placeholder={t`Text to look for`}
            aria-label={t`Text to look for`}
          />
        </InputGroup>
        <Button type="submit" variant="outline">
          <Trans comment="The button that applies the search of a table">Search</Trans>
        </Button>
      </form>
    </search>
  )
}
