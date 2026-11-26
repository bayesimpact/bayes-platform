import { Card, CardContent } from "@bayes-platform/ui/shad/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@bayes-platform/ui/shad/empty"
import { FileIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DocumentSelectionList } from "@/common/components/DocumentSelectionList"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import type { Document } from "@/studio/features/documents/documents.models"
import { selectExtractionAgentSessionsDocuments } from "../agent-sessions/extraction/extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "../agent-sessions/extraction/extraction-agent-sessions.slice"

export function DocumentList({
  onSelectDocument,
}: {
  onSelectDocument: (document: Document) => void
}) {
  const dispatch = useAppDispatch()
  const documents = useValue(selectExtractionAgentSessionsDocuments)
  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-0">
        <DocumentSelectionList
          documents={documents}
          emptyState={<EmptyDocument />}
          onSelect={onSelectDocument}
          onDelete={(documentIds) =>
            dispatch(extractionAgentSessionsActions.deleteMyDocuments({ documentIds }))
          }
        />
      </CardContent>
    </Card>
  )
}

function EmptyDocument() {
  const { t } = useTranslation()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileIcon />
        </EmptyMedia>
        <EmptyTitle>{t("extractionAgentSession:document.empty.title")}</EmptyTitle>
        <EmptyDescription>
          {t("extractionAgentSession:document.empty.description")}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
