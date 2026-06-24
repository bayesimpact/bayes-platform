import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridCard } from "@/common/components/grid/Grid"
import { Loader } from "@/common/components/Loader"
import type { ExtractionAgentSessionSummary } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.models"
import { deleteAgentSession } from "@/common/features/agents/agent-sessions/shared/base-agent-session/base-agent-sessions.thunks"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { useRoutesBuilder } from "@/common/routes/build-routes/context"
import { useAppDispatch } from "@/common/store/hooks"
import { buildDate, buildSince } from "@/common/utils/build-date"
import { DocumentOpener } from "@/studio/features/documents/components/DocumentOpener"
import { extractionAgentSessionsActions } from "../agent-sessions/extraction/extraction-agent-sessions.slice"
import type { AgentCsvExtractionRun } from "../csv-extraction-runs/agent-csv-extraction-runs.models"
import { agentCsvExtractionRunsActions } from "../csv-extraction-runs/agent-csv-extraction-runs.slice"

export function ExtractionSessionItem({
  agentSession,
  className,
  canDelete = true,
}: {
  agentSession: ExtractionAgentSessionSummary
  className?: string
  canDelete?: boolean
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { build } = useRoutesBuilder()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

  const isPending = agentSession.status === "pending"
  const isSuccess = agentSession.status === "success"
  const badge = isSuccess ? buildDate(agentSession.updatedAt) : t(`status:${agentSession.status}`)
  const date = buildSince(agentSession.updatedAt)

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const handleOpen = () => {
    navigate(
      build.agentExtractionRunRoute({
        organizationId,
        projectId,
        agentId: agentSession.agentId,
        extractionRunId: agentSession.id,
      }),
    )
  }

  const handleDelete = () => {
    dispatch(
      deleteAgentSession({
        agentType: "extraction",
        agentId: agentSession.agentId,
        agentSessionId: agentSession.id,
      }),
    )
    setConfirmDeleteOpen(false)
  }

  return (
    <GridCard className={className}>
      <div className="flex gap-2">
        <GridCard.Badge variant="outline">PDF / Image</GridCard.Badge>
        <GridCard.Badge variant={isSuccess ? "secondary" : isPending ? "outline" : "destructive"}>
          <span className="flex items-center gap-1">
            {isPending && <Spinner className="mr-1" />}
            {badge}
          </span>
        </GridCard.Badge>
      </div>

      <GridCard.Body>
        <GridCard.Title>{date}</GridCard.Title>
        <GridCard.Description>
          {agentSession.documentFileName ?? agentSession.documentId}
        </GridCard.Description>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleOpen}>
            {t("actions:open")}
          </Button>
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2Icon />
            </Button>
          )}
        </div>
      </GridCard.Body>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("extractionAgentSession:delete.confirm.title")}
        description={t("extractionAgentSession:delete.confirm.description")}
        confirmLabel={t("extractionAgentSession:delete.confirm.submit")}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </GridCard>
  )
}
export function CsvExtractionSessionItem({
  agentSession,
  className,
  canDelete = true,
}: {
  agentSession: AgentCsvExtractionRun
  className?: string
  canDelete?: boolean
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { build } = useRoutesBuilder()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const isSuccess = agentSession.status === "completed"
  const badge = isSuccess
    ? buildDate(agentSession.updatedAt)
    : t(`agentCsvExtractionRun:results.${agentSession.status}`)
  const date = buildSince(agentSession.updatedAt)

  const handleOpen = () => {
    navigate(
      build.agentExtractionCsvRunRoute({
        organizationId,
        projectId,
        agentId: agentSession.agentId,
        csvRunId: agentSession.id,
      }),
    )
  }

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const handleDelete = () => {
    dispatch(agentCsvExtractionRunsActions.deleteOne({ agentCsvExtractionRunId: agentSession.id }))
    setConfirmDeleteOpen(false)
  }

  return (
    <GridCard className={className}>
      <div className="flex gap-2">
        <GridCard.Badge variant="outline">CSV</GridCard.Badge>
        <GridCard.Badge variant={isSuccess ? "secondary" : "destructive"}>{badge}</GridCard.Badge>
      </div>
      <GridCard.Body>
        <GridCard.Title>{date}</GridCard.Title>
        {agentSession.summary && (
          <GridCard.Description>
            {t("agentCsvExtractionRun:results.processingDescription", {
              processed: agentSession.summary.processed,
              total: agentSession.summary.total,
            })}
          </GridCard.Description>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleOpen}>
            {t("actions:open")}
          </Button>
          {agentSession.csvExportDocumentId && (
            <DocumentOpener
              buttonProps={{ size: "sm" }}
              documentId={agentSession.csvExportDocumentId}
            />
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2Icon />
            </Button>
          )}
        </div>
      </GridCard.Body>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("agentCsvExtractionRun:delete.confirm.title")}
        description={t("agentCsvExtractionRun:delete.confirm.description")}
        confirmLabel={t("agentCsvExtractionRun:delete.confirm.submit")}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </GridCard>
  )
}

export function Actions({
  agentSession,
  isSuccess,
  canDelete = true,
}: {
  agentSession: ExtractionAgentSessionSummary
  isSuccess: boolean
  canDelete?: boolean
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [isLoading, setIsLoading] = useState(false)
  const [runResult, setRunResult] = useState<Record<string, unknown>>()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const handleGetRunResult = async (
    agentSessionId: string,
  ): Promise<Record<string, unknown> | null> => {
    if (runResult) return runResult // cache

    setIsLoading(true)
    try {
      // FIXME:
      const runDetails = await dispatch(
        extractionAgentSessionsActions.getOne({ agentSessionId }),
      ).unwrap()
      if (!runDetails.result) {
        return null
      }
      setRunResult(runDetails.result)
      return runDetails.result as Record<string, unknown>
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = () => {
    dispatch(
      deleteAgentSession({
        agentType: "extraction",
        agentId: agentSession.agentId,
        agentSessionId: agentSession.id,
      }),
    )
    setConfirmDeleteOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      {isSuccess && (
        <>
          <JsonViewer
            runId={agentSession.id}
            result={runResult}
            isLoading={isLoading}
            onRequestRunResult={handleGetRunResult}
          />

          <JsonDownloader
            result={runResult}
            runId={agentSession.id}
            isLoading={isLoading}
            onRequestRunResult={handleGetRunResult}
            fileName={buildRunResultFileName(agentSession.documentFileName, agentSession.id)}
          />
        </>
      )}

      <DocumentOpener noIcon buttonProps={{ size: "sm" }} documentId={agentSession.documentId} />

      {canDelete && (
        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
          <Trash2Icon />
        </Button>
      )}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("extractionAgentSession:delete.confirm.title")}
        description={t("extractionAgentSession:delete.confirm.description")}
        confirmLabel={t("extractionAgentSession:delete.confirm.submit")}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  )
}

function JsonViewer({
  runId,
  result,
  isLoading,
  onRequestRunResult,
}: {
  runId: string
  result?: Record<string, unknown>
  isLoading: boolean
  onRequestRunResult: (runId: string) => Promise<Record<string, unknown> | null>
}) {
  const { t } = useTranslation("extractionAgentSession", { keyPrefix: "result.view" })
  const [open, setOpen] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !result && !isLoading) {
      onRequestRunResult(runId)
    }
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          {t("button")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {result ? (
          <Textarea
            value={JSON.stringify(deepParseJsonStrings(result), null, 2)}
            readOnly
            className="font-mono min-h-56 max-h-96 overflow-auto resize-none"
          />
        ) : isLoading ? (
          <Loader />
        ) : (
          <p className="text-sm text-muted-foreground">{t("error")}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function JsonDownloader({
  runId,
  result,
  isLoading,
  onRequestRunResult,
  fileName,
}: {
  runId: string
  result?: Record<string, unknown>
  isLoading: boolean
  onRequestRunResult: (runId: string) => Promise<Record<string, unknown> | null>
  fileName: string
}) {
  const { t } = useTranslation("extractionAgentSession", { keyPrefix: "result.download" })
  const handleDownload = async () => {
    if (isLoading) {
      return
    }
    const currentRunResult = result ?? (await onRequestRunResult(runId))
    if (!currentRunResult) {
      return
    }
    const serializedResult = JSON.stringify(currentRunResult, null, 2)
    const blob = new Blob([serializedResult], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const linkElement = document.createElement("a")
    linkElement.href = url
    linkElement.download = fileName
    linkElement.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoading}>
      {t("button")}
    </Button>
  )
}

/**
 * Recursively replaces string values that are themselves JSON (objects or
 * arrays) with their parsed form. Extraction results sometimes nest
 * JSON-encoded strings, which `JSON.stringify` would otherwise render with
 * escaped quotes (`\"`); parsing them first yields readable nested JSON.
 */
function deepParseJsonStrings(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim()
    const looksLikeJson =
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    if (!looksLikeJson) {
      return value
    }
    try {
      return deepParseJsonStrings(JSON.parse(trimmed))
    } catch {
      return value
    }
  }

  if (Array.isArray(value)) {
    return value.map(deepParseJsonStrings)
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, deepParseJsonStrings(nestedValue)]),
    )
  }

  return value
}

function buildRunResultFileName(documentFileName: string | null, runId: string): string {
  if (!documentFileName) {
    return `extraction-result-${runId}.json`
  }

  const lastDotIndex = documentFileName.lastIndexOf(".")
  const baseFileName = lastDotIndex > 0 ? documentFileName.slice(0, lastDotIndex) : documentFileName
  return `${baseFileName}-extraction-result.json`
}
