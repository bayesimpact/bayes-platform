import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import {
  DeleteEntryDialog,
  extractionDocumentsQueryOptions,
  extractionRunsQueryOptions,
} from "@/features/history"
import { durationOf } from "@/lib/relative-time"
import { useExtractDocument } from "../api/mutations"
import { extractionRunQueryOptions } from "../api/queries"
import { fileKindOf } from "../extraction-files"
import { EXTRACTION_RUN_STATES } from "../run-states"
import { ExtractionFailure } from "./ExtractionFailure"
import { ExtractionPending } from "./ExtractionPending"
import { ExtractionResult } from "./ExtractionResult"
import { ExtractionRunActions } from "./ExtractionRunActions"
import { RunHeader } from "./RunHeader"
import { RunStatusBadge } from "./RunStatusBadge"

export type ExtractionRunViewProps = {
  agent: AgentParamsDto
  runId: string
}

/**
 * The extraction of one document: while the agent reads it, how long it has been; once done, the
 * fields it filled in; on a failure, why, and a way to try again.
 */
export function ExtractionRunView({ agent, runId }: ExtractionRunViewProps) {
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const { data: run } = useSuspenseQuery(extractionRunQueryOptions(agent, runId))
  const { data: documents } = useSuspenseQuery(extractionDocumentsQueryOptions(agent))
  // useQuery: the history's list, which the sidebar loads, only names a deleted document.
  const { data: runs = [] } = useQuery(extractionRunsQueryOptions(agent))
  const extractAgain = useExtractDocument(agent)
  const [isDeleting, setIsDeleting] = useState(false)

  const document = documents.find((candidate) => candidate.id === run.documentId)
  const documentName =
    document?.fileName ?? runs.find((candidate) => candidate.id === runId)?.documentFileName ?? null
  const title = documentName ?? t`Untitled document`
  const isPending = run.status === "pending"
  const tookTime = durationOf(run.updatedAt - run.createdAt, i18n.locale)
  const detail = typeof run.errorDetails?.message === "string" ? run.errorDetails.message : null

  const handleExtractAgain = () =>
    extractAgain.mutate(run.documentId, {
      onSuccess: (newRunId) =>
        void navigate({
          to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/runs/$extractionRunId",
          params: { ...agent, extractionRunId: newRunId },
        }),
      onError: () => toast.error(t`The extraction could not start. Try again.`),
    })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-10 pb-16">
      <ExtractionRunActions
        agent={agent}
        documentId={run.documentId}
        canExtractAgain={run.status === "success"}
        isExtractingAgain={extractAgain.isPending}
        onExtractAgain={handleExtractAgain}
        onDelete={() => setIsDeleting(true)}
      />
      <RunHeader
        fileKind={fileKindOf({ mimeType: document?.mimeType, fileName: documentName })}
        title={title}
        status={<RunStatusBadge state={EXTRACTION_RUN_STATES[run.status]} />}
        createdAt={run.createdAt}
        duration={isPending ? undefined : t`Took ${tookTime}`}
        now={Date.now()}
      />
      {isPending ? <ExtractionPending createdAt={run.createdAt} /> : null}
      {run.status === "failed" ? (
        <ExtractionFailure
          errorCode={run.errorCode}
          detail={detail}
          isRetrying={extractAgain.isPending}
          onRetry={handleExtractAgain}
        />
      ) : null}
      {run.status === "success" ? (
        <ExtractionResult result={run.result ?? {}} documentName={documentName} />
      ) : null}
      <DeleteEntryDialog
        agent={agent}
        entry={{ kind: "extraction", id: runId }}
        title={title}
        open={isDeleting}
        onOpenChange={setIsDeleting}
        onDeleted={() =>
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/extraction",
            params: agent,
          })
        }
      />
    </div>
  )
}
