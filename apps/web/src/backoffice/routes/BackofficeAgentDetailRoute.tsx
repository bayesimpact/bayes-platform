import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"
import { useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { selectBackofficeAgentDetail } from "../features/backoffice/backoffice.selectors"
import { backofficeActions } from "../features/backoffice/backoffice.slice"
import { BackofficeAgentRoutes, BackofficeProjectRoutes, BackofficeUserRoutes } from "./helpers"

export function BackofficeAgentDetailRoute() {
  const { agentId } = useParams<{ agentId: string }>()
  const dispatch = useAppDispatch()
  const agentDetail = useAppSelector(selectBackofficeAgentDetail)

  useEffect(() => {
    if (!agentId) return
    dispatch(backofficeActions.getAgent(agentId))
    return () => {
      dispatch(backofficeActions.resetAgentDetail())
    }
  }, [agentId, dispatch])

  return (
    <AsyncRoute data={[agentDetail]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const navigate = useNavigate()
  const agent = useValue(selectBackofficeAgentDetail)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(BackofficeAgentRoutes.agents.path)}
          className="gap-1"
        >
          <ArrowLeftIcon className="size-4" />
          Back to agents
        </Button>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{agent.name}</h2>
        <Link
          to={BackofficeProjectRoutes.project.build({ projectId: agent.projectId })}
          className="text-muted-foreground hover:underline flex items-center gap-1 w-fit"
        >
          {agent.projectName}
          <ExternalLinkIcon className="size-3 opacity-60" />
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <MemberSection
          title="Members"
          items={agent.members.map((member) => ({
            key: member.userId,
            label: member.userEmail,
            sublabel: member.userName ?? undefined,
            role: member.role,
            to: BackofficeUserRoutes.user.build({ userId: member.userId }),
          }))}
          emptyText="No members"
        />
      </div>
    </div>
  )
}

type MemberItem = { key: string; label: string; sublabel?: string; role?: string; to?: string }

function MemberSection({
  title,
  items,
  emptyText,
}: {
  title: string
  items: MemberItem[]
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
                  <div className="flex flex-col">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {item.label}
                      <ExternalLinkIcon className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                    )}
                  </div>
                  {item.role && (
                    <Badge variant="secondary" className="text-xs">
                      {item.role}
                    </Badge>
                  )}
                </Link>
              </li>
            ) : (
              <li key={item.key} className="flex items-center justify-between px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.sublabel && (
                    <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                  )}
                </div>
                {item.role && (
                  <Badge variant="secondary" className="text-xs">
                    {item.role}
                  </Badge>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
