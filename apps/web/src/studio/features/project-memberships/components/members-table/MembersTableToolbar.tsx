import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@caseai-connect/ui/shad/input-group"
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { ProjectRoleOption } from "./members-table.models"

export function MembersTableToolbar({
  search,
  onSearchChange,
  roles,
  roleFilter,
  onRoleFilterChange,
  onClearFilters,
  action,
}: {
  search: string
  onSearchChange: (value: string) => void
  roles: ProjectRoleOption[]
  roleFilter: string[]
  onRoleFilterChange: (roleKeys: string[]) => void
  onClearFilters: () => void
  /** Rendered at the end of the toolbar, for the invite button. */
  action?: ReactNode
}) {
  const hasFilters = search.length > 0 || roleFilter.length > 0

  const toggleRole = (roleKey: string, checked: boolean) =>
    onRoleFilterChange(
      checked ? [...roleFilter, roleKey] : roleFilter.filter((key) => key !== roleKey),
    )

  const roleLabel =
    roleFilter.length === 0
      ? "All roles"
      : roleFilter.length === 1
        ? (roles.find((role) => role.key === roleFilter[0])?.name ?? "1 role")
        : `${roleFilter.length} roles`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="w-72">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </InputGroup>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            {roleLabel}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Filter by role</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {roles.map((role) => (
            <DropdownMenuCheckboxItem
              key={role.key}
              checked={roleFilter.includes(role.key)}
              onCheckedChange={(checked) => toggleRole(role.key, checked)}
              onSelect={(event) => event.preventDefault()}
            >
              {role.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-9" onClick={onClearFilters}>
          <XIcon />
          Clear filters
        </Button>
      )}

      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}
