import { Button } from "@caseai-connect/ui/shad/button"
import { XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

/** Shown above a `DataTable` while rows are selected: what is selected, then its actions. */
export function DataTableBulkBar({
  label,
  onClearSelection,
  children,
}: {
  /** What is selected, such as "3 members selected". */
  label: string
  onClearSelection: () => void
  /** The bulk actions, as small outline buttons. */
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <XIcon />
          {t("actions:deselect")}
        </Button>
      </div>
    </div>
  )
}
