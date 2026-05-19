import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@caseai-connect/ui/shad/breadcrumb"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { cn } from "@caseai-connect/ui/utils"
import { CheckIcon, ChevronDownIcon, GitCommitHorizontalIcon } from "lucide-react"
import { Link } from "react-router-dom"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import {
  selectCurrentConversationAgentSessionData,
  selectCurrentConversationAgentSessionsData,
} from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import {
  selectCurrentFormAgentSessionData,
  selectCurrentFormAgentSessionsData,
} from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import type { DeskRoutes } from "@/desk/routes/helpers"
import type { StudioRoutes } from "@/studio/routes/helpers"

type BuildPath =
  | (typeof StudioRoutes)["agentSession"]["build"]
  | (typeof DeskRoutes)["agentSession"]["build"]
export function BreadcrumbAgentSession({
  organizationId,
  buildPath,
}: {
  organizationId: string
  buildPath: BuildPath
}) {
  const agent = useAppSelector(selectCurrentAgentData)
  if (!ADS.isFulfilled(agent)) return null

  switch (agent.value.type) {
    case "conversation":
      return <ConversationAgentSessionList organizationId={organizationId} buildPath={buildPath} />
    case "form":
      return <FormAgentSessionList organizationId={organizationId} buildPath={buildPath} />
    default:
      return null
  }
}

function ConversationAgentSessionList({
  organizationId,
  buildPath,
}: {
  organizationId: string
  buildPath: BuildPath
}) {
  const sessions = useAppSelector(selectCurrentConversationAgentSessionsData)
  const currentSession = useAppSelector(selectCurrentConversationAgentSessionData)
  if (!ADS.isFulfilled(sessions) || !ADS.isFulfilled(currentSession)) return null

  return (
    <WithData
      organizationId={organizationId}
      currentSession={currentSession.value}
      sessions={sessions.value}
      buildPath={buildPath}
    />
  )
}

function FormAgentSessionList({
  organizationId,
  buildPath,
}: {
  organizationId: string
  buildPath: BuildPath
}) {
  const sessions = useAppSelector(selectCurrentFormAgentSessionsData)
  const currentSession = useAppSelector(selectCurrentFormAgentSessionData)
  if (!ADS.isFulfilled(sessions) || !ADS.isFulfilled(currentSession)) return null

  return (
    <WithData
      organizationId={organizationId}
      currentSession={currentSession.value}
      sessions={sessions.value}
      buildPath={buildPath}
    />
  )
}

function WithData({
  organizationId,
  currentSession,
  sessions,
  buildPath,
}: {
  organizationId: string
  currentSession: ConversationAgentSession | FormAgentSession
  sessions: (ConversationAgentSession | FormAgentSession)[]
  buildPath:
    | (typeof StudioRoutes)["agentSession"]["build"]
    | (typeof DeskRoutes)["agentSession"]["build"]
}) {
  const projectId = useAppSelector(selectCurrentProjectId)
  const currentSessionName = buildSince(currentSession.createdAt)
  const currentSessionPath = buildPath({
    organizationId,
    projectId: projectId!,
    agentId: currentSession.agentId,
    agentSessionId: currentSession.id,
  })

  const handleClick =
    ({ agentId, agentSessionId }: { agentId: string; agentSessionId: string }) =>
    () => {
      const path = buildPath({
        organizationId,
        projectId: projectId!,
        agentId,
        agentSessionId,
      })
      window.location.assign(path)
    }
  if (sessions.length === 1)
    return (
      <>
        <BreadcrumbSeparator>
          <GitCommitHorizontalIcon />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Button variant="ghost" size="sm" asChild>
              <Link to={currentSessionPath}>{currentSessionName}</Link>
            </Button>
          </BreadcrumbLink>
        </BreadcrumbItem>
      </>
    )
  return (
    <>
      <BreadcrumbSeparator>
        <GitCommitHorizontalIcon />
      </BreadcrumbSeparator>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            {currentSessionName}
            <ChevronDownIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            {sessions.map((s) => (
              <DropdownMenuItem
                key={s.id}
                className={cn("justify-between", s.id === currentSession.id && "font-semibold")}
                onClick={handleClick({ agentId: s.agentId, agentSessionId: s.id })}
              >
                {buildSince(s.createdAt)}{" "}
                {s.id === currentSession.id && <CheckIcon className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
