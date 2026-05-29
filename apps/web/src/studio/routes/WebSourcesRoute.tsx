import { useMount } from "@/common/hooks/use-mount"
import { useAppSelector } from "@/common/store/hooks"
import { selectDocumentTagsData } from "@/studio/features/document-tags/document-tags.selectors"
import { selectDocumentsData } from "@/studio/features/documents/documents.selectors"
import { documentsActions } from "@/studio/features/documents/documents.slice"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { WebSourcesDocumentList } from "../features/documents/components/web-crawl/WebSourcesDocumentList"

export function WebSourcesRoute() {
  const documents = useAppSelector(selectDocumentsData)
  const documentTags = useAppSelector(selectDocumentTagsData)
  useMount({
    actions: {
      mount: documentsActions.webSourcesMount,
      unmount: documentsActions.webSourcesUnmount,
    },
  })
  return (
    <AsyncRoute data={[documents, documentTags]}>
      <WebSourcesDocumentList />
    </AsyncRoute>
  )
}
