import { Button } from "@caseai-connect/ui/shad/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { ShieldPlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DataTableBulkBar } from "@/common/components/data-table/DataTableBulkBar"

/** Shown above the table while members are selected. */
export function MembersBulkActionBar({
  selectedCount,
  canUpdateRoles,
  canRemoveMembers,
  removeBlockedReason,
  onAddRoles,
  onRemove,
  onClearSelection,
}: {
  selectedCount: number
  canUpdateRoles: boolean
  canRemoveMembers: boolean
  /** Why the selected members cannot be removed together, when they cannot. */
  removeBlockedReason: string | null
  onAddRoles: () => void
  onRemove: () => void
  onClearSelection: () => void
}) {
  const { t } = useTranslation()
  return (
    <DataTableBulkBar
      label={t("projectMembership:table.selected", { count: selectedCount })}
      onClearSelection={onClearSelection}
    >
      {canUpdateRoles && (
        <Button variant="outline" size="sm" onClick={onAddRoles}>
          <ShieldPlusIcon />
          {t("projectMembership:table.addRoles")}
        </Button>
      )}
      {canRemoveMembers &&
        (removeBlockedReason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* aria-disabled rather than disabled: the button keeps focus and hover, for the tooltip. */}
              <Button
                variant="outline"
                size="sm"
                aria-disabled
                className="cursor-not-allowed opacity-50"
              >
                <Trash2Icon />
                {t("actions:remove")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{removeBlockedReason}</TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="outline" size="sm" onClick={onRemove}>
            <Trash2Icon />
            {t("actions:remove")}
          </Button>
        ))}
    </DataTableBulkBar>
  )
}
