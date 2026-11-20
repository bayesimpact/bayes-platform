import { Button } from "@caseai-connect/ui/shad/button"
import { Input } from "@caseai-connect/ui/shad/input"
import { PlusIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { McpServerFormHeaders } from "./mcp-server-form.schema"

type HeaderRow = {
  rowId: number
  name: string
  value: string
  /** The server already stores a value for this header: an empty field keeps it. */
  isStored: boolean
}

function toHeaders(rows: HeaderRow[]): McpServerFormHeaders {
  const headers: McpServerFormHeaders = {}
  for (const row of rows) {
    const name = row.name.trim()
    if (!name) continue
    headers[name] = row.isStored && row.value === "" ? null : row.value
  }
  return headers
}

/**
 * Editor for the static headers of a server. Presentational: it reports the
 * headers on every change and validates nothing. Stored values never reach the
 * browser, so a stored header shows an empty value field that keeps it.
 */
export function McpServerHeadersInput({
  storedHeaderNames,
  onChange,
}: {
  storedHeaderNames: string[]
  onChange: (headers: McpServerFormHeaders) => void
}) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<HeaderRow[]>(() =>
    storedHeaderNames.map((name, index) => ({ rowId: index, name, value: "", isStored: true })),
  )
  const [nextRowId, setNextRowId] = useState(storedHeaderNames.length)

  const update = (nextRows: HeaderRow[]) => {
    setRows(nextRows)
    onChange(toHeaders(nextRows))
  }

  const changeRow = (rowId: number, change: Partial<HeaderRow>) => {
    update(rows.map((row) => (row.rowId === rowId ? { ...row, ...change } : row)))
  }

  const addRow = () => {
    update([...rows, { rowId: nextRowId, name: "", value: "", isStored: false }])
    setNextRowId(nextRowId + 1)
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.rowId} className="flex items-center gap-2">
          <Input
            aria-label={t("mcpServers:fields.headerName")}
            placeholder={t("mcpServers:fields.headerNamePlaceholder")}
            value={row.name}
            // Renaming a stored header would keep nothing to copy its value from.
            readOnly={row.isStored}
            onChange={(event) => changeRow(row.rowId, { name: event.target.value })}
            className="flex-1"
          />
          <Input
            aria-label={t("mcpServers:fields.headerValue")}
            placeholder={
              row.isStored
                ? t("mcpServers:fields.headerValueStoredPlaceholder")
                : t("mcpServers:fields.headerValuePlaceholder")
            }
            type="password"
            autoComplete="off"
            value={row.value}
            onChange={(event) => changeRow(row.rowId, { value: event.target.value })}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("actions:remove")}
            onClick={() => update(rows.filter((other) => other.rowId !== row.rowId))}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={addRow}>
        <PlusIcon className="size-4" /> {t("mcpServers:fields.addHeader")}
      </Button>
    </div>
  )
}
