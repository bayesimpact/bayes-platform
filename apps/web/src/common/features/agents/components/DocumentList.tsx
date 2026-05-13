import { Button } from "@caseai-connect/ui/shad/button"
import { Card, CardContent } from "@caseai-connect/ui/shad/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { FileIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Loader } from "@/common/components/Loader"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import type { Document } from "@/studio/features/documents/documents.models"
import { selectExtractionAgentSessionsDocuments } from "../agent-sessions/extraction/extraction-agent-sessions.selectors"

type OnSelectDocument = { onSelectDocument: (document: Document) => void }

export function DocumentList({ onSelectDocument }: OnSelectDocument) {
  const documents = useAppSelector(selectExtractionAgentSessionsDocuments)
  if (ADS.isFulfilled(documents))
    return <WithData documents={documents.value} onSelectDocument={onSelectDocument} />
  return <Loader />
}

function WithData({ documents, onSelectDocument }: { documents: Document[] } & OnSelectDocument) {
  const { t } = useTranslation()
  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-0">
        {documents.length === 0 ? (
          <EmptyDocument />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium rounded-tl-lg bg-muted">
                  {t("extractionAgentSession:document.props.name")}
                </TableHead>
                <TableHead className="font-medium bg-muted">
                  {t("extractionAgentSession:document.props.createdAt")}
                </TableHead>
                <TableHead className="w-10 rounded-tr-lg bg-muted" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  onSelect={() => onSelectDocument(document)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function DocumentRow({ document, onSelect }: { document: Document; onSelect: () => void }) {
  const date = buildSince(document.createdAt)
  return (
    <TableRow>
      <TableCell>{document.fileName}</TableCell>
      <TableCell className="text-muted-foreground">{date}</TableCell>
      <TableCell>
        <DocumentActions onSelect={onSelect} />
      </TableCell>
    </TableRow>
  )
}

function DocumentActions({ onSelect }: { onSelect: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onSelect}>
        {t("actions:select")}
      </Button>
    </div>
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
