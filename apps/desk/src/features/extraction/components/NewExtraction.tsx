import type { AgentParamsDto, ExtractionDocumentOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { extractionDocumentsQueryOptions } from "@/features/history"
import {
  type StartedExtraction,
  type UploadStep,
  useExtractDocument,
  useUploadAndExtract,
} from "../api/mutations"
import { fileKindOf, fileProblemOf } from "../extraction-files"
import { DeleteDocumentDialog } from "./DeleteDocumentDialog"
import { FileDropZone } from "./FileDropZone"
import { RecentDocuments } from "./RecentDocuments"

export type NewExtractionProps = {
  agent: AgentParamsDto
  agentName: string
}

/**
 * A new extraction, as a new conversation in the Claude app: the place to drop the file, and the
 * documents uploaded before, to extract one again.
 */
export function NewExtraction({ agent, agentName }: NewExtractionProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { data: documents } = useSuspenseQuery(extractionDocumentsQueryOptions(agent))
  const uploadAndExtract = useUploadAndExtract(agent)
  const extractDocument = useExtractDocument(agent)
  const [upload, setUpload] = useState<{ fileName: string; step: UploadStep } | null>(null)
  const [deleted, setDeleted] = useState<ExtractionDocumentOutputDto | null>(null)

  const open = (started: StartedExtraction) =>
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
        size: t`${name} is larger than 25 MB.`,
        empty: t`${name} is empty.`,
      }
      toast.error(messages[problem])
      return
    }
    uploadAndExtract.mutate(
      { file, onStep: (step) => setUpload({ fileName: name, step }) },
      {
        onSuccess: (started) => void open(started),
        onError: () => {
          setUpload(null)
          toast.error(t`${name} could not be uploaded. Try again.`)
        },
      },
    )
  }

  const handleExtract = (document: ExtractionDocumentOutputDto) => {
    if (fileKindOf(document) === "csv") {
      void open({ kind: "csv", documentId: document.id })
      return
    }
    extractDocument.mutate(document.id, {
      onSuccess: (runId) => void open({ kind: "run", runId }),
      onError: () => toast.error(t`The extraction could not start. Try again.`),
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-8 px-4 pt-16 pb-16 md:pt-24">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-balance">
        <Trans>What should {agentName} read?</Trans>
      </h1>
      <FileDropZone onFiles={handleFiles} upload={upload} />
      <RecentDocuments
        documents={documents}
        busyDocumentId={extractDocument.isPending ? (extractDocument.variables ?? null) : null}
        onExtract={handleExtract}
        onDelete={setDeleted}
      />
      <DeleteDocumentDialog agent={agent} document={deleted} onClose={() => setDeleted(null)} />
    </div>
  )
}
