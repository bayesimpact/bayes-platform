import {
  type AgentParamsDto,
  EXTRACTION_MAX_BYTES,
  type ExtractionDocumentOutputDto,
} from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { extractionDocumentsQueryOptions } from "@/features/history"
import { useAbortOnUnmount } from "@/hooks/use-abort-on-unmount"
import { RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, useNow } from "@/hooks/use-now"
import { fileSizeOf } from "@/lib/file-size"
import {
  type StartedExtraction,
  type UploadStep,
  useExtractDocument,
  useUploadAndExtract,
} from "../api/mutations"
import { fileKindOf, fileProblemOf } from "../extraction-files"
import { DeleteDocumentDialog } from "./DeleteDocumentDialog"
import { DocumentPanel } from "./DocumentPanel"
import { FileDropZone } from "./FileDropZone"
import { RecentDocuments } from "./RecentDocuments"

export type NewExtractionProps = {
  agent: AgentParamsDto
  agentName: string
}

/**
 * A new extraction, as a new conversation in the Claude app: the place to drop the file, and the
 * documents uploaded before, to see one beside the page or extract it again. Leaving the page
 * stops an upload.
 */
export function NewExtraction({ agent, agentName }: NewExtractionProps) {
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const now = useNow(RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, true)
  const { data: documents } = useSuspenseQuery(extractionDocumentsQueryOptions(agent))
  const uploadAndExtract = useUploadAndExtract(agent)
  const extractDocument = useExtractDocument(agent)
  const nextUploadSignal = useAbortOnUnmount()
  const [upload, setUpload] = useState<{ fileName: string; step: UploadStep } | null>(null)
  const [documentToDelete, setDocumentToDelete] = useState<ExtractionDocumentOutputDto | null>(null)
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)
  // The details follow the list: a deleted document closes them.
  const openDocument = documents.find((document) => document.id === openDocumentId) ?? null
  const busyDocumentId = extractDocument.isPending ? (extractDocument.variables ?? null) : null
  const maxSize = fileSizeOf(EXTRACTION_MAX_BYTES, i18n.locale)

  const openStarted = (started: StartedExtraction) =>
    started.kind === "run"
      ? navigate({
          to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/runs/$extractionRunId",
          params: { ...agent, extractionRunId: started.runId },
        })
      : navigate({
          to: "/o/$organizationId/p/$projectId/a/$agentId/extraction/csv/$documentId",
          params: { ...agent, documentId: started.documentId },
        })

  const handleFiles = (files: File[]) => {
    const [file] = files
    if (!file) return
    if (files.length > 1) {
      toast.error(t`Give the agent one file at a time.`)
      return
    }
    const name = file.name
    const problem = fileProblemOf(file)
    if (problem) {
      const messages = {
        type: t`${name} cannot be read. Give a PDF, a PNG or JPEG image, a text or a CSV file.`,
        size: t`${name} is larger than ${maxSize}.`,
        empty: t`${name} is empty.`,
      }
      toast.error(messages[problem])
      return
    }
    uploadAndExtract.mutate(
      {
        file,
        onStep: (step) => setUpload({ fileName: name, step }),
        signal: nextUploadSignal(),
      },
      {
        onSuccess: (started) => void openStarted(started),
        onError: () => {
          setUpload(null)
          toast.error(t`${name} could not be uploaded. Try again.`)
        },
      },
    )
  }

  const handleExtract = (document: ExtractionDocumentOutputDto) => {
    if (fileKindOf(document) === "csv") {
      void openStarted({ kind: "csv", documentId: document.id })
      return
    }
    extractDocument.mutate(document.id, {
      onSuccess: (runId) => void openStarted({ kind: "run", runId }),
      onError: () => toast.error(t`The extraction could not start. Try again.`),
    })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 pt-16 pb-16 md:pt-24">
          <h1 className="text-center text-3xl font-semibold tracking-tight text-balance">
            <Trans>What should {agentName} read?</Trans>
          </h1>
          <FileDropZone onFiles={handleFiles} upload={upload} maxSize={maxSize} />
          <RecentDocuments
            documents={documents}
            now={now}
            busyDocumentId={busyDocumentId}
            openDocumentId={openDocument?.id ?? null}
            onOpen={(document) => setOpenDocumentId(document.id)}
            onExtract={handleExtract}
            onDelete={setDocumentToDelete}
          />
        </div>
      </div>
      {openDocument ? (
        <DocumentPanel
          key={openDocument.id}
          document={openDocument}
          isExtracting={busyDocumentId === openDocument.id}
          isDisabled={busyDocumentId !== null}
          onExtract={() => handleExtract(openDocument)}
          onClose={() => setOpenDocumentId(null)}
        />
      ) : null}
      <DeleteDocumentDialog
        agent={agent}
        document={documentToDelete}
        onClose={() => setDocumentToDelete(null)}
      />
    </div>
  )
}
