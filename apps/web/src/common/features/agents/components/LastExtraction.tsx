import { Item, ItemContent } from "@caseai-connect/ui/shad/item"
import { InfoIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { GridHeader } from "@/common/components/grid/Grid"
import { useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import { selectLastExtractionSession } from "../agent-sessions/extraction/extraction-agent-sessions.selectors"
import { Actions } from "./ExtractionAgentSessionItem"

export function LastExtraction({ onBack }: { onBack: () => void }) {
  const lastExtraction = useAppSelector(selectLastExtractionSession)
  const { t } = useTranslation()

  if (!lastExtraction) return null
  return (
    <div className="bg-white">
      <GridHeader
        onBack={onBack}
        title={lastExtraction.documentFileName ?? lastExtraction.documentId}
        description={buildSince(lastExtraction.updatedAt)}
      />

      <div className="p-6 space-y-4">
        <Item variant="muted">
          <InfoIcon />
          <ItemContent>{t("extractionAgentSession:lastExtraction.info")}</ItemContent>
        </Item>

        <Actions
          canDelete={false}
          agentSession={lastExtraction}
          isSuccess={lastExtraction.status === "success"}
        />
      </div>
    </div>
  )
}
