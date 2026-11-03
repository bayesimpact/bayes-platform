import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@caseai-connect/ui/shad/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@caseai-connect/ui/shad/item"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { SearchIcon } from "lucide-react"
import { useState } from "react"
import type { RoleOption } from "@/studio/features/project-memberships/components/member-detail/member-detail.models"
import { useRoleLabel } from "@/studio/features/project-memberships/components/members-table/role-label"
import type { InviteTarget, InviteTargetRole } from "./invite-members.models"

/** Above this many targets, a search box narrows the list. */
const SEARCH_THRESHOLD = 6

/**
 * The agents (or review campaigns) to give a role on: tick one, then pick its role. A target the
 * inviter cannot invite to shows, disabled, so they know it exists and whom to ask.
 */
export function InviteTargetsField({
  idPrefix,
  targets,
  roles,
  value,
  onChange,
  cannotInviteReason,
}: {
  idPrefix: string
  targets: InviteTarget[]
  roles: RoleOption[]
  value: InviteTargetRole[]
  onChange: (value: InviteTargetRole[]) => void
  cannotInviteReason: string
}) {
  const roleLabel = useRoleLabel()
  const [search, setSearch] = useState("")
  const defaultRoleKey = roles[roles.length - 1]?.key ?? ""
  const picked = new Map(value.map((entry) => [entry.targetId, entry.roleKey]))
  const query = search.trim().toLowerCase()
  const visibleTargets = query
    ? targets.filter((target) => target.name.toLowerCase().includes(query))
    : targets

  const toggle = (targetId: string, checked: boolean) =>
    onChange(
      checked
        ? [...value, { targetId, roleKey: defaultRoleKey }]
        : value.filter((entry) => entry.targetId !== targetId),
    )

  const setRole = (targetId: string, roleKey: string) =>
    onChange(value.map((entry) => (entry.targetId === targetId ? { ...entry, roleKey } : entry)))

  return (
    <div className="flex flex-col gap-2">
      {targets.length > SEARCH_THRESHOLD && (
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
      )}
      <ItemGroup className="gap-1">
        {visibleTargets.map((target) => {
          const id = `${idPrefix}-${target.id}`
          const roleKey = picked.get(target.id)
          const isPicked = roleKey !== undefined
          return (
            <Item
              key={target.id}
              variant={isPicked ? "muted" : "default"}
              size="sm"
              className={target.canInvite ? undefined : "opacity-60"}
            >
              <Checkbox
                id={id}
                checked={isPicked}
                disabled={!target.canInvite}
                onCheckedChange={(checked) => toggle(target.id, checked === true)}
              />
              <ItemContent>
                <ItemTitle>
                  <label htmlFor={id} className="cursor-pointer">
                    {target.name}
                  </label>
                </ItemTitle>
                <ItemDescription>
                  {target.canInvite ? target.detail : cannotInviteReason}
                </ItemDescription>
              </ItemContent>
              {isPicked && (
                <ItemActions>
                  <Select
                    value={roleKey}
                    onValueChange={(nextRoleKey) => setRole(target.id, nextRoleKey)}
                  >
                    <SelectTrigger size="sm" className="w-40" aria-label={`Role on ${target.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {roleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ItemActions>
              )}
            </Item>
          )
        })}
        {visibleTargets.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">No match.</p>
        )}
      </ItemGroup>
    </div>
  )
}
