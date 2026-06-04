import { Item } from "@caseai-connect/ui/shad/item"
import { cn } from "@caseai-connect/ui/utils"
import { MessageSquareWarningIcon, ThumbsDownIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridCard } from "@/common/components/grid/Grid"
import { StudioRoutes } from "@/studio/routes/helpers"

export function FeedbackButton({
  agentId,
  organizationId,
  projectId,
  withBorderBottom,
}: {
  agentId: string
  organizationId: string
  projectId: string
  withBorderBottom?: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const handleClick = () => {
    const path = StudioRoutes.feedback.build({ organizationId, projectId, agentId })
    navigate(path)
  }
  return (
    <GridCard className={cn("bg-white", withBorderBottom && "border-b")}>
      <GridCard.Body>
        <GridCard.Title>{t("agentMessageFeedback:feedback")}</GridCard.Title>
        <GridCard.Description>{t("agentMessageFeedback:list.description")}</GridCard.Description>
        <GridCard.GoButton onClick={handleClick} />
      </GridCard.Body>
      <GridCard.Footer>
        <div className="mt-4 flex items-center flex-col max-h-20 overflow-hidden bg-white max-w-full">
          <Item
            variant="outline"
            className="border-b-0 rounded-b-none flex-col w-full flex-1 gap-0"
          >
            <div className="flex flex-1 items-center gap-2 py-2 px-1 w-full">
              <ThumbsDownIcon className="size-3.5 shrink-0 text-destructive" />
              <div className="w-2/3 shrink h-2.5 bg-muted rounded" />
            </div>
            <div className="flex flex-1 items-center gap-2 py-2 px-1 w-full">
              <MessageSquareWarningIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="w-1/2 shrink h-2.5 bg-muted rounded" />
            </div>
          </Item>
        </div>
      </GridCard.Footer>
    </GridCard>
  )
}
