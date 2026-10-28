import {
  BACKOFFICE_GLOBAL_ROLE_KEYS,
  type BackofficeGlobalRoleKey,
  type GrantBackofficeUserGlobalRoleRequestDto,
  grantBackofficeUserGlobalRoleSchema,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@caseai-connect/ui/shad/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { XIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { selectCanUpdateGlobalRoles } from "@/common/features/me/me.selectors"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { BackofficeUserGlobalRole } from "../backoffice.models"
import { backofficeActions } from "../backoffice.slice"
import { RolePermissionBadge } from "./RolePermissionBadge"

const GLOBAL_ROLE_LABELS: Record<BackofficeGlobalRoleKey, string> = {
  platform_superadmin: "Platform Superadmin",
  platform_staff: "Platform Staff",
  platform_org_creator: "Platform Organization Creator",
}

function isBackofficeGlobalRoleKey(value: string): value is BackofficeGlobalRoleKey {
  return (BACKOFFICE_GLOBAL_ROLE_KEYS as readonly string[]).includes(value)
}

/** The roles a user holds everywhere, and, for a superadmin, the controls to change them. */
export function UserGlobalRolesSection({
  userId,
  globalRoles,
}: {
  userId: string
  globalRoles: BackofficeUserGlobalRole[]
}) {
  const canUpdate = useAppSelector(selectCanUpdateGlobalRoles)
  const heldRoleKeys = new Set(globalRoles.map((globalRole) => globalRole.key))
  const grantableRoleKeys = BACKOFFICE_GLOBAL_ROLE_KEYS.filter(
    (roleKey) => !heldRoleKeys.has(roleKey),
  )

  if (globalRoles.length === 0 && !canUpdate) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Global roles</h3>
      <p className="text-xs text-muted-foreground">These roles apply everywhere.</p>
      {globalRoles.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No global role</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {globalRoles.map((globalRole) => (
            <div key={globalRole.key} className="flex items-center gap-0.5">
              <RolePermissionBadge
                role={globalRole.name}
                roleKey={globalRole.key}
                permissions={globalRole.permissions}
              />
              {canUpdate && isBackofficeGlobalRoleKey(globalRole.key) && (
                <RevokeGlobalRoleButton
                  userId={userId}
                  roleKey={globalRole.key}
                  roleName={globalRole.name}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {canUpdate && grantableRoleKeys.length > 0 && (
        <GrantGlobalRoleForm userId={userId} grantableRoleKeys={grantableRoleKeys} />
      )}
    </div>
  )
}

function RevokeGlobalRoleButton({
  userId,
  roleKey,
  roleName,
}: {
  userId: string
  roleKey: BackofficeGlobalRoleKey
  roleName: string
}) {
  const dispatch = useAppDispatch()
  const handleRevoke = () => {
    void dispatch(backofficeActions.revokeUserGlobalRole({ userId, roleKey }))
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      onClick={handleRevoke}
      aria-label={`Remove ${roleName}`}
    >
      <XIcon className="size-3.5" />
    </Button>
  )
}

function GrantGlobalRoleForm({
  userId,
  grantableRoleKeys,
}: {
  userId: string
  grantableRoleKeys: BackofficeGlobalRoleKey[]
}) {
  const dispatch = useAppDispatch()
  const form = useForm<GrantBackofficeUserGlobalRoleRequestDto>({
    resolver: zodResolver(grantBackofficeUserGlobalRoleSchema),
  })

  const onValid = async ({ roleKey }: GrantBackofficeUserGlobalRoleRequestDto) => {
    const result = await dispatch(backofficeActions.grantUserGlobalRole({ userId, roleKey }))
    if (backofficeActions.grantUserGlobalRole.fulfilled.match(result)) form.reset()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onValid)} className="flex items-start gap-2 pt-1">
        <FormField
          control={form.control}
          name="roleKey"
          render={({ field }) => (
            <FormItem className="w-72">
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a global role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {grantableRoleKeys.map((roleKey) => (
                    <SelectItem key={roleKey} value={roleKey}>
                      {GLOBAL_ROLE_LABELS[roleKey]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Grant
        </Button>
      </form>
    </Form>
  )
}
