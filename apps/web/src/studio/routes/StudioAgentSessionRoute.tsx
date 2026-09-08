import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { selectConversationSubSessionsBySessionId } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import type { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { selectCurrentMessagesData } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.selectors"
import { AgentSessionMessages } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessages"
import {
  findVersion,
  resolveMessageRevision,
} from "@/common/features/agents/agent-settings/agent-settings.functions"
import {
  selectAgentSettingsDataByAgentId,
  selectAgentSettingsHistoryDataByAgentId,
  selectPlaygroundRevision,
} from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { DeleteAgentSessionButton } from "@/common/features/agents/components/DeleteAgentSessionButton"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import { TraceUrlOpener } from "@/studio/components/TraceUrlOpener"
import { AgentRevisionBadge } from "@/studio/features/agents/agent-settings/components/AgentRevisionBadge"
import { AgentSettingsVersionSelect } from "../features/agents/agent-settings/components/AgentSettingsVersionSelect"

type AgentSession = ConversationAgentSession
export function StudioAgentSessionRoute({ agentSession }: { agentSession: AgentSession }) {
  const agent = useValue(selectCurrentAgentData)
  const publishedSettings = useValue(selectAgentSettingsDataByAgentId({ agentId: agent.id }))
  const messages = useValue(selectCurrentMessagesData)
  const selectSubSessions = useMemo(
    () => selectConversationSubSessionsBySessionId(agentSession.id),
    [agentSession.id],
  )
  const formSubSessions = useAppSelector(selectSubSessions)

  const { t } = useTranslation()
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()

  const date = buildSince(agentSession.updatedAt)

  const handleBack = () => navigate(agentRoute)

  const versions = useValue(
    selectAgentSettingsHistoryDataByAgentId({ agentId: agent.id, includeDraft: true }),
  )

  const selectPlayground = useMemo(
    () => selectPlaygroundRevision({ agentId: agent.id }),
    [agent.id],
  )
  const runningRevision = useAppSelector(selectPlayground)

  // The fillForm panel must describe the schema of the version being run, not of the published
  // one, or a draft that changed the form renders the wrong questions.
  const runningSettings =
    (runningRevision !== undefined ? findVersion(versions, runningRevision) : undefined) ??
    publishedSettings

  const renderMessageVersion = (message: AgentSessionMessage) => {
    const revision = resolveMessageRevision(message, runningRevision)
    if (revision === undefined) return null
    return (
      <AgentRevisionBadge
        agent={agent}
        revision={revision}
        versions={versions}
        tooltipKey="messageRevisionTooltip"
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <GridHeader
        onBack={handleBack}
        title={t("agent:playground")}
        description={
          <div className="flex items-center gap-2 flex-wrap">
            {date}
            {runningRevision && (
              <>
                {" "}
                •
                <AgentRevisionBadge
                  agent={agent}
                  revision={runningRevision}
                  versions={versions}
                  tooltipKey="headerRevisionTooltip"
                />
              </>
            )}
          </div>
        }
        action={
          <>
            <TraceUrlOpener
              buttonProps={{ variant: "secondary" }}
              traceUrl={agentSession.traceUrl}
            />
            <DeleteAgentSessionButton agent={agent} agentSession={agentSession} />
          </>
        }
      />

      <div className="flex-1">
        <AgentSessionMessages
          session={agentSession}
          messages={messages}
          formSubSessions={formSubSessions}
          formResultSchema={
            runningSettings.fillFormEnabled ? runningSettings.outputJsonSchema : undefined
          }
          renderMessageVersion={renderMessageVersion}
          renderVersionSelect={
            <AgentSettingsVersionSelect agentId={agent.id} revision={runningRevision} />
          }
        />
      </div>
    </div>
  )
}
