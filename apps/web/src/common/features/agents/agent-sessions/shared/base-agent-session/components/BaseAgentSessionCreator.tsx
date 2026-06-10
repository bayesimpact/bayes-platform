import { Button } from "@caseai-connect/ui/shad/button"
import { SidebarMenuSubButton } from "@caseai-connect/ui/shad/sidebar"
import throttle from "lodash/throttle"
import { PlusCircleIcon, PlusIcon } from "lucide-react"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { useRoutesBuilder } from "@/common/routes/build-routes/context"
import { useAppDispatch } from "@/common/store/hooks"
import { createAgentChatSession } from "../base-agent-sessions.thunks"

export function BaseAgentSessionCreator({
  agentType,
  type,
  ids,
}: {
  agentType: Agent["type"]
  type: "button" | "menu"
  ids: { agentId: string; projectId: string; organizationId: string }
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { build } = useRoutesBuilder()
  const onSuccess = useCallback(
    (agentSessionId: string) => {
      const path = build.agentSessionRoute({ ...ids, agentSessionId })
      navigate(path)
    },
    [build.agentSessionRoute, ids, navigate],
  )

  const handleClick = useMemo(
    () =>
      throttle(
        () => {
          dispatch(createAgentChatSession({ agentType, agentId: ids.agentId, onSuccess }))
        },
        2000,
        { trailing: false },
      ),
    [agentType, ids.agentId, dispatch, onSuccess],
  )
  if (type === "button") {
    return (
      <Button size="lg" className="text-base" onClick={handleClick}>
        {t("actions:create")}
        <PlusCircleIcon className="ml-2 size-5" />
      </Button>
    )
  }
  return (
    <SidebarMenuSubButton onClick={handleClick} className="cursor-pointer">
      <PlusIcon />
      <span>{t(`${agentType}AgentSession:create.button`)}</span>
    </SidebarMenuSubButton>
  )
}
