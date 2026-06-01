import { ScrollArea } from "@caseai-connect/ui/shad/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@caseai-connect/ui/shad/sheet"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { selectReviewCampaignDetail } from "../review-campaigns.selectors"
import { reviewCampaignsActions } from "../review-campaigns.slice"
import type { CampaignFormAgentOption } from "./CampaignForm"
import { CreateCampaignForm } from "./CreateCampaignForm"
import { UpdateCampaignForm } from "./UpdateCampaignForm"

type Props = {
  open: boolean
  agents: CampaignFormAgentOption[]
  mode: "create" | "edit"
  reviewCampaignId?: string
  onClose: () => void
}

export function CampaignEditorSheet({ open, agents, mode, reviewCampaignId, onClose }: Props) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const detail = useAppSelector(selectReviewCampaignDetail)

  useEffect(() => {
    if (open && mode === "edit" && reviewCampaignId) {
      dispatch(reviewCampaignsActions.selectDetail({ reviewCampaignId }))
    }
    return () => {
      if (!open) dispatch(reviewCampaignsActions.clearSelectedDetail())
    }
  }, [dispatch, open, mode, reviewCampaignId])

  return (
    <Sheet modal open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="h-dvh">
        <ScrollArea className="h-full">
          <SheetHeader>
            <SheetTitle>
              {mode === "create"
                ? t("reviewCampaigns:editor.createTitle")
                : t("reviewCampaigns:editor.editTitle")}
            </SheetTitle>
            <SheetDescription>
              {mode === "create"
                ? t("reviewCampaigns:editor.createDescription")
                : t("reviewCampaigns:editor.editDescription")}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {mode === "create" ? (
              <CreateCampaignForm agents={agents} onSuccess={onClose} />
            ) : ADS.isFulfilled(detail) ? (
              <UpdateCampaignForm
                campaign={detail.value}
                agents={agents}
                onSuccess={onClose}
                onDeleted={onClose}
              />
            ) : ADS.isError(detail) ? (
              <p className="text-destructive text-sm">{detail.error}</p>
            ) : (
              <p className="text-muted-foreground text-sm">{t("reviewCampaigns:loading")}</p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
