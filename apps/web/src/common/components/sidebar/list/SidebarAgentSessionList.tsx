import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import {
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@caseai-connect/ui/shad/sidebar"
import { cn } from "@caseai-connect/ui/utils"
import { MessagesSquareIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { selectCurrentConversationAgentSessionsDataFromAgentId } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import { selectCurrentAgentSessionId } from "@/common/features/agents/agent-sessions/current-agent-session-id/current-agent-session-id.selectors"
import { selectCurrentFormAgentSessionsDataFromAgentId } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import { deleteAgentSession } from "@/common/features/agents/agent-sessions/shared/base-agent-session/base-agent-sessions.thunks"
import { BaseAgentSessionCreator } from "@/common/features/agents/agent-sessions/shared/base-agent-session/components/BaseAgentSessionCreator"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useRoutesBuilder } from "@/common/routes/build-routes/context"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import type { MenuItem } from "../types"

type AgentSessionProps = {
  organizationId: string
  projectId: string
  agentId: string
  agentType: Agent["type"]
}
export function SidebarAgentSessionList(props: AgentSessionProps) {
  switch (props.agentType) {
    case "conversation":
      return <ConversationAgentSessionList {...props} />
    case "form":
      return <FormAgentSessionList {...props} />
    default:
      return null
  }
}

function FormAgentSessionList(props: AgentSessionProps) {
  const currentAgentId = useAppSelector(selectCurrentAgentId)
  const sessionsData = useAppSelector(selectCurrentFormAgentSessionsDataFromAgentId(props.agentId))
  if (!ADS.isFulfilled(sessionsData)) return null

  const isActive = currentAgentId === props.agentId
  return (
    <SessionList isActive={isActive} sessions={sessionsData.value} agentSessionProps={props}>
      {isActive && <BaseAgentSessionCreator agentType="form" ids={props} type="menu" />}
    </SessionList>
  )
}

function ConversationAgentSessionList(props: AgentSessionProps) {
  const currentAgentId = useAppSelector(selectCurrentAgentId)
  const sessionsData = useAppSelector(
    selectCurrentConversationAgentSessionsDataFromAgentId(props.agentId),
  )
  if (!ADS.isFulfilled(sessionsData)) return null

  const isActive = currentAgentId === props.agentId
  return (
    <SessionList sessions={sessionsData.value} isActive={isActive} agentSessionProps={props}>
      {isActive && <BaseAgentSessionCreator agentType="conversation" ids={props} type="menu" />}
    </SessionList>
  )
}

function SessionList({
  sessions,
  agentSessionProps,
  isActive,
  children,
}: {
  isActive: boolean
  sessions: ConversationAgentSession[]
  agentSessionProps: AgentSessionProps
  children?: React.ReactNode
}) {
  const currentSessionId = useAppSelector(selectCurrentAgentSessionId)
  const { build } = useRoutesBuilder()
  const items: MenuItem[] = sessions.map((session) => ({
    id: session.id,
    title: buildSince(session.createdAt),
    url: build.agentSessionRoute({ ...agentSessionProps, agentSessionId: session.id }),
    isActive: currentSessionId === session.id,
    icon: MessagesSquareIcon,
  }))

  return (
    <SidebarMenuSub>
      {children}

      {isActive &&
        items.map((item) => (
          <SidebarMenuSubItem key={item.id}>
            <SidebarMenuSubButton
              asChild
              isActive={item.isActive}
              className={cn(item.isActive && "font-semibold")}
            >
              <Link to={item.url}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>

                <OptionsMenu
                  agentId={agentSessionProps.agentId}
                  agentSessionId={item.id}
                  agentType={agentSessionProps.agentType}
                />
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        ))}
    </SidebarMenuSub>
  )
}

function OptionsMenu({
  agentId,
  agentSessionId,
  agentType,
}: {
  agentId: string
  agentSessionId: string
  agentType: Agent["type"]
}) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { isMobile } = useSidebar()
  const { t } = useTranslation()
  const getAgentRoute = useGetAgentRoute()
  const handleSuccess = () => navigate(getAgentRoute())
  const handleDelete = () => {
    dispatch(deleteAgentSession({ agentType, agentId, agentSessionId, onSuccess: handleSuccess }))
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction showOnHover>
          <MoreHorizontalIcon />
          <span className="sr-only">{t("actions:more")}</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-48 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align={isMobile ? "end" : "start"}
      >
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2Icon className="text-muted-foreground" />
          <span>{t("actions:delete")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
