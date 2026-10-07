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
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { selectCurrentConversationAgentSessionsDataFromAgentId } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import { selectCurrentAgentSessionId } from "@/common/features/agents/agent-sessions/current-agent-session-id/current-agent-session-id.selectors"
import { deleteAgentSession } from "@/common/features/agents/agent-sessions/shared/base-agent-session/base-agent-sessions.thunks"
import { BaseAgentSessionCreator } from "@/common/features/agents/agent-sessions/shared/base-agent-session/components/BaseAgentSessionCreator"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
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
    default:
      return null
  }
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
  const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null)
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

                <OptionsMenu onDelete={() => setSessionIdToDelete(item.id)} />
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        ))}

      {/* Outside the session links, so clicks in the dialog do not navigate to a session. */}
      <ConfirmDeleteSessionDialog
        agentSessionProps={agentSessionProps}
        agentSessionId={sessionIdToDelete}
        onClose={() => setSessionIdToDelete(null)}
      />
    </SidebarMenuSub>
  )
}

function OptionsMenu({ onDelete }: { onDelete: () => void }) {
  const { isMobile } = useSidebar()
  const { t } = useTranslation()
  const handleDelete = (event: React.MouseEvent) => {
    // The menu sits inside the session link: keep the click from opening the session.
    event.stopPropagation()
    onDelete()
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

function ConfirmDeleteSessionDialog({
  agentSessionProps,
  agentSessionId,
  onClose,
}: {
  agentSessionProps: AgentSessionProps
  agentSessionId: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const { build } = useRoutesBuilder()
  const { organizationId, projectId, agentId, agentType } = agentSessionProps
  const handleSuccess = () => navigate(build.agentRoute({ organizationId, projectId, agentId }))
  const handleDelete = () => {
    if (agentSessionId) {
      dispatch(deleteAgentSession({ agentType, agentId, agentSessionId, onSuccess: handleSuccess }))
    }
    onClose()
  }
  return (
    <ConfirmDialog
      open={agentSessionId !== null}
      title={t("conversationAgentSession:delete.confirm.title")}
      description={t("conversationAgentSession:delete.confirm.description")}
      onConfirm={handleDelete}
      onCancel={onClose}
    />
  )
}
