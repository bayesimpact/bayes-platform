import { Button } from "@caseai-connect/ui/shad/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { ShieldPlusIcon, Trash2Icon, XIcon } from "lucide-react"

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
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
      <span className="text-sm font-medium">
        {selectedCount === 1 ? "1 member selected" : `${selectedCount} members selected`}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {canUpdateRoles && (
          <Button variant="outline" size="sm" onClick={onAddRoles}>
            <ShieldPlusIcon />
            Add roles
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
                  Remove
                </Button>
              </TooltipTrigger>
              <TooltipContent>{removeBlockedReason}</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="outline" size="sm" onClick={onRemove}>
              <Trash2Icon />
              Remove
            </Button>
          ))}
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <XIcon />
          Clear selection
        </Button>
      </div>
    </div>
  )
}
