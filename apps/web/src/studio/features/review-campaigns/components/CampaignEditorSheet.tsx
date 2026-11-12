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
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import { CampaignReportPage } from "../reports/components/CampaignReportPage"
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
  view: "form" | "report"
  onClose: () => void
}

export function CampaignEditorSheet({
  open,
  agents,
  mode,
  reviewCampaignId,
  view,
  onClose,
}: Props) {
  const dispatch = useAppDispatch()
  const detail = useAppSelector(selectReviewCampaignDetail)

  useEffect(() => {
    if (open && mode === "edit" && reviewCampaignId) {
      dispatch(reviewCampaignsActions.selectDetail({ reviewCampaignId }))
    }
    // The sheet is unmounted rather than closed, so clear on every cleanup:
    // a stale detail would seed the form's defaultValues on the next open.
    return () => {
      dispatch(reviewCampaignsActions.clearSelectedDetail())
    }
  }, [dispatch, open, mode, reviewCampaignId])

  return (
    <Sheet modal open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="h-dvh">
        <ScrollArea className="h-full">
          {mode === "edit" && reviewCampaignId && view === "report" ? (
            <CampaignReportView reviewCampaignId={reviewCampaignId} />
          ) : (
            <CampaignEditorView mode={mode} detail={detail} agents={agents} onClose={onClose} />
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// The report replaces the form in the sheet, and its back arrow returns to the form.
function CampaignReportView({ reviewCampaignId }: { reviewCampaignId: string }) {
  const { t } = useTranslation()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  return (
    <>
      <SheetTitle className="sr-only">{t("reviewCampaigns:report.title")}</SheetTitle>
      <CampaignReportPage
        // Leaves room for the sheet's close button in the top-right corner.
        headerClassName="pr-8"
        backPath={StudioRoutes.reviewCampaign.build({
          organizationId,
          projectId,
          reviewCampaignId,
        })}
      />
    </>
  )
}

function CampaignEditorView({
  mode,
  detail,
  agents,
  onClose,
}: {
  mode: "create" | "edit"
  detail: ReturnType<typeof selectReviewCampaignDetail>
  agents: CampaignFormAgentOption[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
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
    </>
  )
}
