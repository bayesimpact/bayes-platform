import { Badge } from "@bayes-platform/ui/shad/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@bayes-platform/ui/shad/popover"

export function RolePermissionBadge({
  role,
  roleKey,
  permissions,
}: {
  role: string
  roleKey?: string | null
  permissions?: string[]
}) {
  if (!permissions || permissions.length === 0) {
    return (
      <Badge variant="secondary" className="text-xs">
        {role}
      </Badge>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full focus-visible:outline-none">
          <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
            {role}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{role}</p>
          {roleKey && <p className="text-xs font-mono text-muted-foreground">{roleKey}</p>}
        </div>
        <ul className="space-y-1">
          {permissions.map((permission) => (
            <li key={permission} className="font-mono text-xs text-foreground">
              {permission}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
