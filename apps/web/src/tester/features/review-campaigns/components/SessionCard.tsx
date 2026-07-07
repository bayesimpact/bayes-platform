import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Item, ItemContent } from "@caseai-connect/ui/shad/item"
import { CheckCircle2Icon, CircleAlertIcon, MessageSquareIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { buildDate } from "@/common/utils/build-date"
import type { MyTesterSessionSummary } from "../tester.models"

type Props = {
  session: MyTesterSessionSummary
  onOpenFeedback: (id: string) => void
  onDelete?: (id: string) => void
  onResume: (id: string) => void
}

const STATUS_CONFIG: Record<
  MyTesterSessionSummary["feedbackStatus"],
  {
    variant: React.ComponentProps<typeof Badge>["variant"]
    icon: React.ElementType
  }
> = {
  submitted: { variant: "success", icon: CheckCircle2Icon },
  pending: { variant: "outline", icon: CircleAlertIcon },
  abandoned: { variant: "secondary", icon: CircleAlertIcon },
}

export function SessionCard({ session, onOpenFeedback, onDelete, onResume }: Props) {
  const { t } = useTranslation()
  const status = STATUS_CONFIG[session.feedbackStatus]
  const StatusIcon = status.icon
  return (
    <Item
      variant="outline"
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <ItemContent className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{buildDate(session.createdAt)}</span>
        </div>
        <Badge variant={status.variant} className="w-fit gap-1">
          <StatusIcon className="size-3" />{" "}
          {t(`testerCampaigns:sessionCard.status.${session.feedbackStatus}`)}
        </Badge>
      </ItemContent>
      <div className="flex items-center gap-2 flex-wrap">
        {session.feedbackStatus === "pending" && (
          <Button variant="outline" size="sm" onClick={() => onOpenFeedback(session.id)}>
            {t("testerCampaigns:sessionCard.actions.giveFeedback")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onResume(session.id)}>
          {t("testerCampaigns:sessionCard.actions.open")}
        </Button>
        {session.feedbackStatus === "pending" && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(session.id)}
            aria-label={t("testerCampaigns:sessionCard.actions.delete")}
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
      </div>
    </Item>
  )
}
