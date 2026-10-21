import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { PlusIcon, XIcon } from "lucide-react"
import type { MemberResourceRoles, RoleOption } from "./member-detail.models"

/**
 * The member's roles on one resource, each removable, and a menu to add the roles of the
 * resource's scope they do not hold yet.
 */
export function ResourceRoleChips({
  resource,
  editable,
  lockedRoles,
  onAddRole,
  onRemoveRole,
}: {
  resource: MemberResourceRoles
  /** False on the viewer's own page or without the permission: the roles are shown only. */
  editable: boolean
  /** Roles that cannot be removed, with the reason shown on hover. */
  lockedRoles: Record<string, string>
  onAddRole: (role: RoleOption) => void
  onRemoveRole: (role: RoleOption) => void
}) {
  const heldKeys = new Set(resource.roles.map((role) => role.key))
  const addableRoles = resource.grantableRoles.filter((role) => !heldKeys.has(role.key))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {resource.roles.length === 0 && (
        <span className="text-sm text-muted-foreground">No access</span>
      )}
      {resource.roles.map((role) => {
        const lockReason = lockedRoles[role.key]
        return (
          <Badge key={role.key} variant="outline" className="gap-1 pr-1">
            {role.name}
            {editable &&
              (lockReason ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-disabled
                      aria-label={`${role.name} cannot be removed`}
                      className="cursor-not-allowed rounded-sm p-0.5 opacity-40"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{lockReason}</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  type="button"
                  aria-label={`Remove ${role.name}`}
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onRemoveRole(role)}
                >
                  <XIcon className="size-3" />
                </button>
              ))}
          </Badge>
        )
      })}
      {editable && addableRoles.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" aria-label={`Add a role on ${resource.resourceName}`}>
              <PlusIcon />
              Add role
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Add a role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {addableRoles.map((role) => (
              <DropdownMenuItem key={role.key} onSelect={() => onAddRole(role)}>
                {role.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
