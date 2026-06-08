import { Item, ItemContent } from "@caseai-connect/ui/shad/item"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import type { Document } from "@/studio/features/documents/documents.models"
import { FileUploader } from "../../../components/FileUploader"
import { GridHeader } from "../../../components/grid/Grid"
import { selectIsExtracting } from "../../../features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "../../../features/agents/agent-sessions/extraction/extraction-agent-sessions.slice"
import { selectCurrentAgentData } from "../../../features/agents/agents.selectors"
import { DocumentList } from "../../../features/agents/components/DocumentList"
import { LastExtraction } from "../../../features/agents/components/LastExtraction"
import { agentCsvExtractionRunsThunks } from "../../../features/agents/csv-extraction-runs/agent-csv-extraction-runs.thunks"
import { CsvExtractor } from "../../../features/agents/csv-extraction-runs/components/CsvExtractor"
import { useGetAgentRoute } from "../../../hooks/use-get-path"
import { useValue } from "../../../hooks/use-value"
import { useAppDispatch, useAppSelector } from "../../../store/hooks"
import type { BuildAgentExtractionCsvRunRoute } from "../../build-routes/context"
import { ErrorRoute } from "../../ErrorRoute"

export function AgentExtractionRoute({
  buildCsvRunPath,
}: {
  buildCsvRunPath: BuildAgentExtractionCsvRunRoute
}) {
  const dispatch = useAppDispatch()
  const outlet = useOutlet()
  const navigate = useNavigate()
  const agent = useValue(selectCurrentAgentData)
  const [csvDocumentId, setCsvDocumentId] = useState<string | null>(null)
  const [openLastExtraction, setOpenLastExtraction] = useState(false)
  const agentPath = useGetAgentRoute()

  const handleBack = () => navigate(agentPath)

  const handleSuccess = ({ isCsv, documentId }: { isCsv: boolean; documentId?: string }) => {
    if (isCsv && documentId) {
      setCsvDocumentId(documentId)
      dispatch(agentCsvExtractionRunsThunks.getFileColumns({ agentId: agent.id, documentId }))
    } else {
      setOpenLastExtraction(true)
    }
  }

  if (agent.type !== "extraction")
    return <ErrorRoute error={`${agent.name} is not an extraction agent`} />

  if (outlet) return outlet
  if (csvDocumentId)
    return (
      <CsvExtractor
        buildCsvRunPath={buildCsvRunPath}
        onBack={() => setCsvDocumentId(null)}
        documentId={csvDocumentId}
      />
    )
  if (openLastExtraction) return <LastExtraction onBack={handleBack} />
  return <FileManager agentId={agent.id} onSuccess={handleSuccess} />
}

function FileManager({
  agentId,
  onSuccess,
}: {
  agentId: string
  onSuccess: (params: { isCsv: boolean; documentId?: string }) => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const path = useGetAgentRoute()
  const isExtracting = useAppSelector(selectIsExtracting)

  const handleBack = () => {
    navigate(path)
  }

  const handleSubmit = (data: { file: File } | { document: Document }) => {
    if (!data) return
    if ("file" in data && data.file.type === "text/csv") {
      dispatch(
        agentCsvExtractionRunsThunks.uploadCsvFile({
          file: data.file,
          onSuccess: (documentId) => onSuccess({ isCsv: true, documentId }),
        }),
      )
    } else if ("document" in data && data.document.mimeType === "text/csv") {
      onSuccess({ isCsv: true, documentId: data.document.id })
    }
    // For non-csv files, we directly create and execute the extraction session
    else
      dispatch(
        extractionAgentSessionsActions.executeOne({
          ...data,
          agentId,
          onSuccess: () => onSuccess({ isCsv: false }),
        }),
      )
  }

  return (
    <div>
      <GridHeader
        onBack={handleBack}
        title={t("extractionAgentSession:create.title")}
        description={t("extractionAgentSession:create.description")}
        action={
          <FileUploader
            disabled={isExtracting}
            maxFiles={1}
            allowedMimeTypes={{
              "application/pdf": true,
              "image/jpeg": true,
              "text/csv": true,
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
        {isExtracting ? (
          <Item variant="muted">
            <Spinner />
            <ItemContent>{t("extractionAgentSession:create.processingMessage")}</ItemContent>
          </Item>
        ) : (
          <DocumentList onSelectDocument={(document) => handleSubmit({ document })} />
        )}
      </div>
    </div>
  )
}
