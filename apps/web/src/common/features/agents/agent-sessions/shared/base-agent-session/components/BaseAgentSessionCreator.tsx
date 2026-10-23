import { extractPromptVariables } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { SidebarMenuSubButton } from "@caseai-connect/ui/shad/sidebar"
import throttle from "lodash/throttle"
import { PlusCircleIcon, PlusIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
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

  // The playground asks for the declared {{variables}} before creating a session, when the
  // tested settings declare some and the feature is on; every other channel creates directly.
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const testedAgentSettings = useAppSelector(
    selectPlaygroundAgentSettings({ agentId: ids.agentId }),
  )
  const needsVariablesDialog =
    agentType === "conversation" &&
    buildType() === "playground" &&
    hasFeature("agent-prompt-variables") &&
    testedAgentSettings !== null &&
    extractPromptVariables(testedAgentSettings.instructions).length > 0

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
          if (needsVariablesDialog) setVariablesDialogOpen(true)
          else createSession()
        },
        2000,
        { trailing: false },
      ),
    [needsVariablesDialog, createSession],
  )

  const variablesDialog = (
    <PromptVariablesSessionDialog
      open={variablesDialogOpen}
      onOpenChange={setVariablesDialogOpen}
      agentSettings={testedAgentSettings}
      onConfirm={(variables) => {
        setVariablesDialogOpen(false)
        createSession(variables)
      }}
    />
  )

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
