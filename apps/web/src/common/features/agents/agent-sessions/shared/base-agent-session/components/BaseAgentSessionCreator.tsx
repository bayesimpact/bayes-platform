import { Button } from "@caseai-connect/ui/shad/button"
import { SidebarMenuSubButton } from "@caseai-connect/ui/shad/sidebar"
import throttle from "lodash/throttle"
import { PlusCircleIcon, PlusIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { useRoutesBuilder } from "@/common/routes/build-routes/context"
import { useAppDispatch } from "@/common/store/hooks"
import { createAgentChatSession } from "../base-agent-sessions.thunks"

export type RenderVariablesDialogParams = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (variables: Record<string, string>) => void
}

export type BaseAgentSessionCreatorProps = {
  agentType: Agent["type"]
  type: "button" | "menu"
  ids: { agentId: string; projectId: string; organizationId: string }
  /**
   * Collects the prompt variables before the session is created. A render prop because the
   * dialog reads the settings under test from the store, which only Studio loads. When omitted,
   * the session is created directly.
   */
  renderVariablesDialog?: (params: RenderVariablesDialogParams) => React.ReactNode
}

export function BaseAgentSessionCreator({
  agentType,
  type,
  ids,
  renderVariablesDialog,
}: BaseAgentSessionCreatorProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { build } = useRoutesBuilder()

  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false)

  const onSuccess = useCallback(
    (agentSessionId: string) => {
      const path = build.agentSessionRoute({ ...ids, agentSessionId })
      navigate(path)
    },
    [build.agentSessionRoute, ids, navigate],
  )

  const createSession = useCallback(
    (variables?: Record<string, string>) => {
      dispatch(createAgentChatSession({ agentType, agentId: ids.agentId, variables, onSuccess }))
    },
    [agentType, ids.agentId, dispatch, onSuccess],
  )

  const handleClick = useMemo(
    () =>
      throttle(
        () => {
          if (renderVariablesDialog) setVariablesDialogOpen(true)
          else createSession()
        },
        2000,
        { trailing: false },
      ),
    [renderVariablesDialog, createSession],
  )

  const variablesDialog = renderVariablesDialog?.({
    open: variablesDialogOpen,
    onOpenChange: setVariablesDialogOpen,
    onConfirm: (variables) => {
      setVariablesDialogOpen(false)
      createSession(variables)
    },
  })

  if (type === "button") {
    return (
      <>
        <Button size="lg" className="text-base" onClick={handleClick}>
          {t("actions:create")}
          <PlusCircleIcon className="ml-2 size-5" />
        </Button>
        {variablesDialog}
      </>
    )
  }
  return (
    <>
      <SidebarMenuSubButton onClick={handleClick} className="cursor-pointer">
        <PlusIcon />
        <span>{t(`${agentType}AgentSession:create.button`)}</span>
      </SidebarMenuSubButton>
      {variablesDialog}
    </>
  )
}
