import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { MessagesSquareIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { EvaluationConversationDatasetCreator } from "./EvaluationConversationDatasetCreator"

export function EmptyEvaluationConversationDataset() {
  const { t } = useTranslation("evaluationConversationDataset", { keyPrefix: "dataset.list.empty" })
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessagesSquareIcon />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{t("description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-col justify-center gap-2">
        <EvaluationConversationDatasetCreator />
      </EmptyContent>
    </Empty>
  )
}
