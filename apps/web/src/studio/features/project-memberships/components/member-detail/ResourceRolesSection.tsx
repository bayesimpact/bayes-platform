import { Button } from "@caseai-connect/ui/shad/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@caseai-connect/ui/shad/collapsible"
import { ChevronDownIcon, type LucideIcon } from "lucide-react"
import { GroupedPermissionList } from "../GroupedPermissionList"
import type { MemberResourceRoles, RoleOption } from "./member-detail.models"
import { ResourceRoleChips } from "./ResourceRoleChips"

/** One kind of resource (the workspace, its agents, its campaigns) and the member's roles on each. */
export function ResourceRolesSection({
  icon: Icon,
  title,
  description,
  emptyLabel,
  resources,
  readOnly,
  lockedRolesFor,
  onAddRole,
  onRemoveRole,
}: {
  icon: LucideIcon
  title: string
  description: string
  emptyLabel: string
  resources: MemberResourceRoles[]
  /** True on the viewer's own page: nothing is editable, whatever the permissions. */
  readOnly: boolean
  lockedRolesFor: (resource: MemberResourceRoles) => Record<string, string>
  onAddRole: (resource: MemberResourceRoles, role: RoleOption) => void
  onRemoveRole: (resource: MemberResourceRoles, role: RoleOption) => void
}) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {resources.length === 0 ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="divide-y">
            {resources.map((resource) => (
              <ResourceRolesRow
                key={`${resource.kind}:${resource.resourceId}`}
                resource={resource}
                editable={!readOnly && resource.canManage}
                lockedRoles={lockedRolesFor(resource)}
                onAddRole={(role) => onAddRole(resource, role)}
                onRemoveRole={(role) => onRemoveRole(resource, role)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ResourceRolesRow({
  resource,
  editable,
  lockedRoles,
  onAddRole,
  onRemoveRole,
}: {
  resource: MemberResourceRoles
  editable: boolean
  lockedRoles: Record<string, string>
  onAddRole: (role: RoleOption) => void
  onRemoveRole: (role: RoleOption) => void
}) {
  return (
    <li>
      <Collapsible className="flex flex-col gap-3 px-6 py-4">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
          <div className="flex w-56 shrink-0 flex-col">
            <span className="text-sm">{resource.resourceName}</span>
            {resource.detail && (
              <span className="text-xs text-muted-foreground">{resource.detail}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <ResourceRoleChips
              resource={resource}
              editable={editable}
              lockedRoles={lockedRoles}
              onAddRole={onAddRole}
              onRemoveRole={onRemoveRole}
            />
          </div>
          {resource.permissions.length > 0 && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="xs" className="group text-muted-foreground">
                {resource.permissions.length === 1
                  ? "1 permission"
                  : `${resource.permissions.length} permissions`}
                <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
        <CollapsibleContent>
          <div className="rounded-md bg-muted/40 p-4">
            <GroupedPermissionList permissions={resource.permissions} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}
