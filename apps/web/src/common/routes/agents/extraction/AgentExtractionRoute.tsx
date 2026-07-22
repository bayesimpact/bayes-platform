import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { useMount } from "@/common/hooks/use-mount"
import type { Document } from "@/studio/features/documents/documents.models"
import { FileUploader } from "../../../components/FileUploader"
import { GridHeader } from "../../../components/grid/Grid"
import { selectExtractionAgentSessionsDocuments } from "../../../features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "../../../features/agents/agent-sessions/extraction/extraction-agent-sessions.slice"
import { selectCurrentAgentData } from "../../../features/agents/agents.selectors"
import { DocumentList } from "../../../features/agents/components/DocumentList"
import { agentCsvExtractionRunsThunks } from "../../../features/agents/csv-extraction-runs/agent-csv-extraction-runs.thunks"
import { CsvExtractor } from "../../../features/agents/csv-extraction-runs/components/CsvExtractor"
import { selectCurrentOrganizationId } from "../../../features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "../../../features/projects/projects.selectors"
import { useGetAgentRoute } from "../../../hooks/use-get-path"
import { useCurrentId, useValue } from "../../../hooks/use-value"
import { useAppDispatch, useAppSelector } from "../../../store/hooks"
import { AsyncRoute } from "../../AsyncRoute"
import type { BuildAgentExtractionCsvRunRoute } from "../../build-routes/context"
import { useRoutesBuilder } from "../../build-routes/context"
import { ErrorRoute } from "../../ErrorRoute"

export function AgentExtractionRoute(props: { buildCsvRunPath: BuildAgentExtractionCsvRunRoute }) {
  const documents = useAppSelector(selectExtractionAgentSessionsDocuments)
  const agent = useValue(selectCurrentAgentData)
  const [csvDocumentId, setCsvDocumentId] = useState<string | null>(null)

  useMount({ actions: extractionAgentSessionsActions, refreshOn: [agent.id] })

  if (agent.type !== "extraction")
    return <ErrorRoute error={`${agent.name} is not an extraction agent`} />
  return (
    <AsyncRoute data={[documents]}>
      <WithData
        {...props}
        agentId={agent.id}
        csvDocumentId={csvDocumentId}
        setCsvDocumentId={setCsvDocumentId}
      />
    </AsyncRoute>
  )
}

function WithData({
  buildCsvRunPath,
  agentId,
  csvDocumentId,
  setCsvDocumentId,
}: {
  buildCsvRunPath: BuildAgentExtractionCsvRunRoute
  agentId: string
  csvDocumentId: string | null
  setCsvDocumentId: (id: string | null) => void
}) {
  const dispatch = useAppDispatch()
  const outlet = useOutlet()
  const navigate = useNavigate()
  const { build } = useRoutesBuilder()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

  const handleCsvSuccess = (documentId: string) => {
    setCsvDocumentId(documentId)
    dispatch(agentCsvExtractionRunsThunks.getFileColumns({ agentId, documentId }))
  }

  const handleExtractionRunSuccess = (extractionRunId: string) => {
    navigate(build.agentExtractionRunRoute({ organizationId, projectId, agentId, extractionRunId }))
  }

  if (outlet) return outlet
  if (csvDocumentId)
    return (
      <CsvExtractor
        buildCsvRunPath={buildCsvRunPath}
        onBack={() => setCsvDocumentId(null)}
        documentId={csvDocumentId}
      />
    )
  return (
    <FileManager
      agentId={agentId}
      onCsvSuccess={handleCsvSuccess}
      onExtractionRunSuccess={handleExtractionRunSuccess}
    />
  )
}

function FileManager({
  agentId,
  onCsvSuccess,
  onExtractionRunSuccess,
}: {
  agentId: string
  onCsvSuccess: (documentId: string) => void
  onExtractionRunSuccess: (runId: string) => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const path = useGetAgentRoute()

  const handleBack = () => navigate(path)

  const handleSubmit = (data: { file: File } | { document: Document }) => {
    if (!data) return
    if ("file" in data && data.file.type === "text/csv") {
      dispatch(
        agentCsvExtractionRunsThunks.uploadCsvFile({
          file: data.file,
          onSuccess: onCsvSuccess,
        }),
      )
    } else if ("document" in data && data.document.mimeType === "text/csv") {
      onCsvSuccess(data.document.id)
    } else {
      dispatch(
        extractionAgentSessionsActions.executeOne({
          ...data,
          agentId,
          onSuccess: onExtractionRunSuccess,
        }),
      )
    }
  }

  return (
    <div>
      <GridHeader
        onBack={handleBack}
        title={t("extractionAgentSession:create.title")}
        description={t("extractionAgentSession:create.description")}
        action={
          <FileUploader
            maxFiles={1}
            allowedMimeTypes={{
              "application/pdf": true,
              "image/jpeg": true,
              "text/csv": true,
              "text/markdown": true,
              "text/plain": true,
            }}
            onDropFiles={(files) => {
              const file = files[0]
              if (!file) return
              handleSubmit({ file })
            }}
          />
        }
      />

      <div className="p-4">
        <DocumentList onSelectDocument={(document) => handleSubmit({ document })} />
      </div>
    </div>
  )
}
