import { Button } from "@caseai-connect/ui/shad/button"
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"
import { useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { selectCanUpdateUserGlobalRoles } from "@/common/features/me/me.selectors"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type {
  BackofficeUserDetail,
  BackofficeUserGlobalRole,
} from "../features/backoffice/backoffice.models"
import { selectBackofficeUserDetail } from "../features/backoffice/backoffice.selectors"
import { backofficeActions } from "../features/backoffice/backoffice.slice"
import { RolePermissionBadge } from "../features/backoffice/components/RolePermissionBadge"
import {
  BackofficeAgentRoutes,
  BackofficeOrganizationRoutes,
  BackofficeProjectRoutes,
  BackofficeUserRoutes,
} from "./helpers"

export function BackofficeUserDetailRoute() {
  const { userId } = useParams<{ userId: string }>()
  const dispatch = useAppDispatch()
  const userDetail = useAppSelector(selectBackofficeUserDetail)

  // useEffect is intentional: the ID comes from useParams (URL), not Redux state. See BackofficeAgentDetailRoute for rationale.
  useEffect(() => {
    if (!userId) return
    dispatch(backofficeActions.getUser(userId))
    return () => {
      dispatch(backofficeActions.resetUserDetail())
    }
  }, [userId, dispatch])

  return (
    <AsyncRoute data={[userDetail]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const navigate = useNavigate()
  const user = useValue(selectBackofficeUserDetail)
  const canUpdateUserGlobalRoles = useAppSelector(selectCanUpdateUserGlobalRoles)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(BackofficeUserRoutes.users.path)}
          className="gap-1"
        >
          <ArrowLeftIcon className="size-4" />
          Back to users
        </Button>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{user.email}</h2>
        {user.name && <p className="text-muted-foreground">{user.name}</p>}
      </div>

      {user.globalRoles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Global roles</h3>
          <p className="text-xs text-muted-foreground">These roles apply everywhere.</p>
          <div className="flex flex-wrap gap-2">
            {user.globalRoles.map((globalRole) => (
              <RolePermissionBadge
                key={globalRole.key}
                role={globalRole.name}
                roleKey={globalRole.key}
                permissions={globalRole.permissions}
              />
            ))}
          </div>
        </div>
      )}

      {canUpdateUserGlobalRoles && user.grantableGlobalRoles.length > 0 && (
        <GrantableGlobalRolesSection user={user} />
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MembershipSection
          title="Organizations"
          items={user.organizationMemberships.map((membership) => ({
            key: membership.organizationId,
            label: membership.organizationName,
            role: membership.role,
            roleKey: membership.roleKey,
            permissions: membership.permissions,
            to: BackofficeOrganizationRoutes.organization.build({
              organizationId: membership.organizationId,
            }),
          }))}
          emptyText="No organization memberships"
        />
        <MembershipSection
          title="Projects"
          items={user.projectMemberships.map((membership) => ({
            key: membership.projectId,
            label: membership.projectName,
            role: membership.role,
            roleKey: membership.roleKey,
            permissions: membership.permissions,
            to: BackofficeProjectRoutes.project.build({ projectId: membership.projectId }),
          }))}
          emptyText="No project memberships"
        />
        <MembershipSection
          title="Agents"
          items={user.agentMemberships.map((membership) => ({
            key: membership.agentId,
            label: membership.agentName,
            role: membership.role,
            roleKey: membership.roleKey,
            permissions: membership.permissions,
            to: BackofficeAgentRoutes.agent.build({ agentId: membership.agentId }),
          }))}
          emptyText="No agent memberships"
        />
        <MembershipSection
          title="Review campaigns"
          items={user.reviewCampaignMemberships.map((membership) => ({
            key: `${membership.campaignId}:${membership.role}`,
            label: membership.campaignName,
            role: membership.role,
          }))}
          emptyText="No review campaign memberships"
        />
      </div>
    </div>
  )
}

/** Roles granted person by person from here, such as reading any conversation for safety review. */
function GrantableGlobalRolesSection({ user }: { user: BackofficeUserDetail }) {
  const grantedRoleKeys = new Set(user.globalRoles.map((globalRole) => globalRole.key))
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Special access</h3>
      <p className="text-xs text-muted-foreground">
        Nobody holds these roles by default. Grant them only to the people who need them.
      </p>
      <ul className="border rounded-lg divide-y">
        {user.grantableGlobalRoles.map((grantableRole) => (
          <GrantableGlobalRoleRow
            key={grantableRole.key}
            userId={user.id}
            role={grantableRole}
            isGranted={grantedRoleKeys.has(grantableRole.key)}
          />
        ))}
      </ul>
    </div>
  )
}

function GrantableGlobalRoleRow({
  userId,
  role,
  isGranted,
}: {
  userId: string
  role: BackofficeUserGlobalRole
  isGranted: boolean
}) {
  const dispatch = useAppDispatch()
  const handleClick = () => {
    const params = { userId, roleKey: role.key }
    void dispatch(
      isGranted
        ? backofficeActions.revokeUserGlobalRole(params)
        : backofficeActions.grantUserGlobalRole(params),
    )
  }
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <RolePermissionBadge role={role.name} roleKey={role.key} permissions={role.permissions} />
      <Button variant={isGranted ? "outline" : "default"} size="sm" onClick={handleClick}>
        {isGranted ? "Revoke" : "Grant"}
      </Button>
    </li>
  )
}

type MembershipItem = {
  key: string
  label: string
  role: string
  roleKey?: string | null
  permissions?: string[]
  to?: string
}

function MembershipSection({
  title,
  items,
  emptyText,
}: {
  title: string
  items: MembershipItem[]
  emptyText: string
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center italic">{emptyText}</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-3">
              {item.to ? (
                <Link
                  to={item.to}
                  className="text-sm font-medium flex items-center gap-1.5 min-w-0 hover:underline group"
                >
                  <span className="truncate">{item.label}</span>
                  <ExternalLinkIcon className="size-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                </Link>
              ) : (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              <RolePermissionBadge
                role={item.role}
                roleKey={item.roleKey}
                permissions={item.permissions}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
