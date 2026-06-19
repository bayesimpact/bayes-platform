import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { useTranslation } from "react-i18next"
import { DocumentSelectionList } from "@/common/components/DocumentSelectionList"
import { Loader } from "@/common/components/Loader"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { EvaluationExtractionDatasetFile } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import { selectFilesData } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.selectors"
import { evaluationExtractionDatasetsActions } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.slice"
import { currentIdsActions } from "@/eval/store/currentIds.slice"
import { EmptyFile } from "./EmptyFile"
import { UploadFile } from "./UploadFile"
import { UploaderState } from "./UploadState"

export function FileList() {
  const files = useAppSelector(selectFilesData)
  if (ADS.isFulfilled(files)) return <WithData files={files.value} />
  return <Loader />
}

function WithData({ files }: { files: EvaluationExtractionDatasetFile[] }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluation:file.title")}</CardTitle>
        <CardDescription>{t("evaluation:file.description")}</CardDescription>
        <CardAction>
          <UploadFile />
        </CardAction>
      </CardHeader>

      <CardContent>
        <UploaderState />
        <DocumentSelectionList
          documents={files}
          emptyState={<EmptyFile />}
          onSelect={(file) => dispatch(currentIdsActions.setFileId(file.id))}
          onDelete={(fileIds) =>
            dispatch(evaluationExtractionDatasetsActions.deleteFiles({ fileIds }))
          }
        />
      </CardContent>
    </Card>
  )
}
