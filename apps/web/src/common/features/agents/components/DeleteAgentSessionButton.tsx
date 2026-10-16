import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { deleteAgentSession } from "@/common/features/agents/agent-sessions/shared/base-agent-session/base-agent-sessions.thunks"
import type { Agent } from "@/common/features/agents/agents.models"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useAppDispatch } from "@/common/store/hooks"

export function DeleteAgentSessionButton({
  agent,
  agentSession,
}: {
  agent: Agent
  agentSession: ConversationAgentSession
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const handleSuccess = () => navigate(agentRoute)
  const handleDelete = () => {
    dispatch(
      deleteAgentSession({
        agentType: agent.type,
        agentId: agent.id,
        agentSessionId: agentSession.id,
        onSuccess: handleSuccess,
      }),
    )
    setConfirmDeleteOpen(false)
  }

  return (
    <>
      <Button variant="outline" size="icon" onClick={() => setConfirmDeleteOpen(true)}>
        <Trash2Icon />
      </Button>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("conversationAgentSession:delete.confirm.title")}
        description={t("conversationAgentSession:delete.confirm.description")}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  )
}
