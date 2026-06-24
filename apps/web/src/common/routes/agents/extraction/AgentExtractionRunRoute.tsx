import { Badge } from "@caseai-connect/ui/shad/badge"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import {
  selectCurrentExtractionRunData,
  selectCurrentExtractionRunId,
} from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.slice"
import { Actions } from "@/common/features/agents/components/ExtractionAgentSessionItem"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import { TraceUrlOpener } from "@/studio/components/TraceUrlOpener"
import { AsyncRoute } from "../../AsyncRoute"
import { LoadingRoute } from "../../LoadingRoute"

export function AgentExtractionRunRoute() {
  const runData = useAppSelector(selectCurrentExtractionRunData)
  const runId = useAppSelector(selectCurrentExtractionRunId)

  useMount({
    actions: {
      mount: extractionAgentSessionsActions.sessionMount,
      unmount: extractionAgentSessionsActions.sessionUnmount,
    },
    condition: !!runId,
    refreshOn: [runId],
  })

  if (!runId) return <LoadingRoute />
  return (
    <AsyncRoute data={[runData]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const navigate = useNavigate()
  const run = useValue(selectCurrentExtractionRunData)
  const { t } = useTranslation()
  const agentPath = useGetAgentRoute()

  const isPending = run.status === "pending"
  const isSuccess = run.status === "success"

  return (
    <div>
      <GridHeader
        title={run.documentFileName ?? run.documentId}
        description={
          <div className="flex flex-col gap-2">
            {buildSince(run.updatedAt)}
            <div className="flex gap-2">
              <Badge variant={isSuccess ? "success" : isPending ? "outline" : "destructive"}>
                {t(`status:${run.status}`)}
              </Badge>
            </div>
          </div>
        }
        onBack={() => navigate(agentPath)}
        action={
          <TraceUrlOpener
            traceUrl={run.traceUrl}
            buttonProps={{ size: "sm", variant: "outline" }}
          />
        }
      />

      <div className="p-6 bg-white">
        {isPending ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Spinner />
            <span>{t("extractionAgentSession:create.processingMessage")}</span>
          </div>
        ) : (
          <Actions canDelete agentSession={run} isSuccess={isSuccess} />
        )}
      </div>
    </div>
  )
}
