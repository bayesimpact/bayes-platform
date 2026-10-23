import { extractPromptVariables } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { SidebarMenuSubButton } from "@caseai-connect/ui/shad/sidebar"
import throttle from "lodash/throttle"
import { PlusCircleIcon, PlusIcon } from "lucide-react"
import { type ReactNode, useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { selectPlaygroundAgentSettings } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { useRoutesBuilder } from "@/common/routes/build-routes/context"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { PromptVariablesSessionDialog } from "@/studio/features/agents/prompt-variables/PromptVariablesSessionDialog"
import { buildType, createAgentChatSession } from "../base-agent-sessions.thunks"

type SessionCreatorProps = {
  agentType: Agent["type"]
  type: "button" | "menu"
  ids: { agentId: string; projectId: string; organizationId: string }
}

// Only the playground reads the agent settings: Desk registers no agentSettings slice, so the
// other channels must not reach for it.
export function BaseAgentSessionCreator(props: SessionCreatorProps) {
  if (props.agentType === "conversation" && buildType() === "playground")
    return <PlaygroundSessionCreator {...props} />
  return <DirectSessionCreator {...props} />
}

function DirectSessionCreator({ agentType, type, ids }: SessionCreatorProps) {
  const createSession = useCreateSession({ agentType, ids })
  const handleClick = useThrottledClick(createSession)
  return <SessionCreatorTrigger agentType={agentType} type={type} onClick={handleClick} />
}

// The playground asks for the declared {{variables}} before creating a session, when the
// tested settings declare some and the feature is on.
function PlaygroundSessionCreator({ agentType, type, ids }: SessionCreatorProps) {
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const testedAgentSettings = useAppSelector(
    selectPlaygroundAgentSettings({ agentId: ids.agentId }),
  )
  const needsVariablesDialog =
    hasFeature("agent-prompt-variables") &&
    testedAgentSettings !== null &&
    extractPromptVariables(testedAgentSettings.instructions).length > 0

  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false)
  const createSession = useCreateSession({ agentType, ids })
  const handleClick = useThrottledClick(
    useCallback(() => {
      if (needsVariablesDialog) setVariablesDialogOpen(true)
      else createSession()
    }, [needsVariablesDialog, createSession]),
  )

  return (
    <SessionCreatorTrigger agentType={agentType} type={type} onClick={handleClick}>
      <PromptVariablesSessionDialog
        open={variablesDialogOpen}
        onOpenChange={setVariablesDialogOpen}
        agentSettings={testedAgentSettings}
        onConfirm={(variables) => {
          setVariablesDialogOpen(false)
          createSession(variables)
        }}
      />
    </SessionCreatorTrigger>
  )
}

function useCreateSession({ agentType, ids }: Pick<SessionCreatorProps, "agentType" | "ids">) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { build } = useRoutesBuilder()

  const onSuccess = useCallback(
    (agentSessionId: string) => {
      const path = build.agentSessionRoute({ ...ids, agentSessionId })
      navigate(path)
    },
    [build.agentSessionRoute, ids, navigate],
  )

  return useCallback(
    (variables?: Record<string, string>) => {
      dispatch(createAgentChatSession({ agentType, agentId: ids.agentId, variables, onSuccess }))
    },
    [agentType, ids.agentId, dispatch, onSuccess],
  )
}

// The click event is dropped: forwarded to `createSession`, it would be sent as the variables.
function useThrottledClick(onClick: () => void) {
  return useMemo(() => throttle(() => onClick(), 2000, { trailing: false }), [onClick])
}

function SessionCreatorTrigger({
  agentType,
  type,
  onClick,
  children,
}: Pick<SessionCreatorProps, "agentType" | "type"> & {
  onClick: () => void
  children?: ReactNode
}) {
  const { t } = useTranslation()

  if (type === "button") {
    return (
      <>
        <Button size="lg" className="text-base" onClick={onClick}>
          {t("actions:create")}
          <PlusCircleIcon className="ml-2 size-5" />
        </Button>
        {children}
      </>
    )
  }
  return (
    <>
      <SidebarMenuSubButton onClick={onClick} className="cursor-pointer">
        <PlusIcon />
        <span>{t(`${agentType}AgentSession:create.button`)}</span>
      </SidebarMenuSubButton>
      {children}
    </>
  )
}
