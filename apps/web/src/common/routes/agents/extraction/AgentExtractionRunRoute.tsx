import { Badge } from "@bayes-platform/ui/shad/badge"
import { Spinner } from "@bayes-platform/ui/shad/spinner"
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
import { buildDuration, buildSince } from "@/common/utils/build-date"
import { TraceUrlOpener } from "@/studio/components/TraceUrlOpener"
import { AsyncRoute } from "../../AsyncRoute"
import { LoadingRoute } from "../../LoadingRoute"

/**
 * `renderRevisionBadge` labels the run with the agent settings version it ran with. It is a
 * render prop because the badge reads the settings history from the store, which only Studio
 * loads — Desk mounts this route without it.
 */
type Props = { renderRevisionBadge?: (revision: number) => React.ReactNode }

export function AgentExtractionRunRoute({ renderRevisionBadge }: Props) {
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
      <WithData renderRevisionBadge={renderRevisionBadge} />
    </AsyncRoute>
  )
}

function WithData({ renderRevisionBadge }: Props) {
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
              {isSuccess && (
                <Badge variant="secondary">
                  {t("extractionAgentSession:result.duration", {
                    duration: buildDuration(run.createdAt, run.updatedAt),
                  })}
                </Badge>
              )}
              {renderRevisionBadge?.(run.agentRevision)}
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
