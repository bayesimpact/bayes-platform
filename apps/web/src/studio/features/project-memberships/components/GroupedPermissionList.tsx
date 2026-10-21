import { useTranslation } from "react-i18next"
import { groupPermissions } from "@/studio/features/project-memberships/permission-groups"

/** `columns` spreads the groups over up to three columns, `stack` keeps them in one, for a table cell. */
export function GroupedPermissionList({
  permissions,
  layout = "columns",
}: {
  permissions: string[]
  layout?: "columns" | "stack"
}) {
  const { t } = useTranslation()
  return (
    <div className={layout === "columns" ? "columns-1 gap-8 md:columns-2 xl:columns-3" : undefined}>
      {groupPermissions(permissions).map((group) => (
        <section key={group.key} className="mb-5 last:mb-0 break-inside-avoid flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t(`permissionGroup:${group.key}`)}</h3>
          <PermissionList permissions={group.permissions} />
        </section>
      ))}
    </div>
  )
}

function PermissionList({ permissions }: { permissions: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {permissions.map((permission) => (
        <PermissionItem key={permission} permission={permission} />
      ))}
    </ul>
  )
}

function PermissionItem({ permission }: { permission: string }) {
  const { t } = useTranslation()
  const label = t(`permission:${permission}`, { keySeparator: false, defaultValue: "" })
  if (!label) return <li className="font-mono text-xs">{permission}</li>
  return (
    <li className="flex flex-col">
      <span className="text-sm">{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{permission}</span>
    </li>
  )
}
