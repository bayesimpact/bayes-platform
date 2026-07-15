import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { GlobeIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CrawlUrlButton } from "./CrawlUrlButton"

export function EmptyWebSources() {
  const { t } = useTranslation("document", { keyPrefix: "webSources.empty" })
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <GlobeIcon />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{t("description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-col justify-center gap-2">
        <CrawlUrlButton />
      </EmptyContent>
    </Empty>
  )
}
