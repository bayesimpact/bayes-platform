import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"
import { useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { selectBackofficeUserDetail } from "../features/backoffice/backoffice.selectors"
import { backofficeActions } from "../features/backoffice/backoffice.slice"
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

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MembershipSection
          title="Organizations"
          items={user.organizationMemberships.map((membership) => ({
            key: membership.organizationId,
            label: membership.organizationName,
            role: membership.role,
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

type MembershipItem = { key: string; label: string; role: string; to?: string }

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
          {items.map((item) =>
            item.to ? (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    {item.label}
                    <ExternalLinkIcon className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {item.role}
                  </Badge>
                </Link>
              </li>
            ) : (
              <li key={item.key} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium">{item.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {item.role}
                </Badge>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
