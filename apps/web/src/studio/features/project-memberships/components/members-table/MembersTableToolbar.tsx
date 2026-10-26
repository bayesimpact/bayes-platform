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
import { useTranslation } from "react-i18next"
import type { ProjectRoleOption } from "./members-table.models"
import { useRoleLabel } from "./role-label"

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
  const { t } = useTranslation()
  const roleName = useRoleLabel()
  const hasFilters = search.length > 0 || roleFilter.length > 0

  const toggleRole = (roleKey: string, checked: boolean) =>
    onRoleFilterChange(
      checked ? [...roleFilter, roleKey] : roleFilter.filter((key) => key !== roleKey),
    )

  const filteredRole =
    roleFilter.length === 1 ? roles.find((role) => role.key === roleFilter[0]) : undefined
  const roleLabel =
    roleFilter.length === 0
      ? t("projectMembership:table.allRoles")
      : filteredRole
        ? roleName(filteredRole)
        : t("projectMembership:table.rolesCount", { count: roleFilter.length })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="w-72">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder={t("projectMembership:list.searchPlaceholder")}
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
          <DropdownMenuLabel>{t("projectMembership:table.filterByRole")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {roles.map((role) => (
            <DropdownMenuCheckboxItem
              key={role.key}
              checked={roleFilter.includes(role.key)}
              onCheckedChange={(checked) => toggleRole(role.key, checked)}
              onSelect={(event) => event.preventDefault()}
            >
              {roleName(role)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-9" onClick={onClearFilters}>
          <XIcon />
          {t("projectMembership:table.clearFilters")}
        </Button>
      )}

      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}
