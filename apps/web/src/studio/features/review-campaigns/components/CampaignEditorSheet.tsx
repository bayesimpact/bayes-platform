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
import { CampaignReportPage } from "../reports/components/CampaignReportPage"
import { selectReviewCampaignDetail } from "../review-campaigns.selectors"
import { reviewCampaignsActions } from "../review-campaigns.slice"
import type { CampaignFormAgentOption } from "./CampaignForm"
import { CreateCampaignForm } from "./CreateCampaignForm"
import { UpdateCampaignForm } from "./UpdateCampaignForm"

// An existing campaign opens at its own URL (editorPath), so its report can lead back to it.
export type CampaignEditor =
  | { mode: "create" }
  | { mode: "edit"; reviewCampaignId: string; view: "form" | "report"; editorPath: string }

type Props = {
  open: boolean
  agents: CampaignFormAgentOption[]
  editor: CampaignEditor
  onClose: () => void
}

export function CampaignEditorSheet({ open, agents, editor, onClose }: Props) {
  const dispatch = useAppDispatch()
  const detail = useAppSelector(selectReviewCampaignDetail)
  const reviewCampaignId = editor.mode === "edit" ? editor.reviewCampaignId : undefined

  useEffect(() => {
    if (open && reviewCampaignId) {
      dispatch(reviewCampaignsActions.selectDetail({ reviewCampaignId }))
    }
    // The sheet is unmounted rather than closed, so clear on every cleanup:
    // a stale detail would seed the form's defaultValues on the next open.
    return () => {
      dispatch(reviewCampaignsActions.clearSelectedDetail())
    }
  }, [dispatch, open, reviewCampaignId])

  return (
    <Sheet modal open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="h-dvh">
        <ScrollArea className="h-full">
          {editor.mode === "edit" && editor.view === "report" ? (
            <CampaignReportView editorPath={editor.editorPath} />
          ) : (
            <CampaignEditorView
              mode={editor.mode}
              detail={detail}
              agents={agents}
              onClose={onClose}
            />
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// The report replaces the form in the sheet, and its back arrow returns to the form.
function CampaignReportView({ editorPath }: { editorPath: string }) {
  const { t } = useTranslation()
  return (
    <>
      <SheetTitle className="sr-only">{t("reviewCampaigns:report.title")}</SheetTitle>
      {/* pr-8 leaves room for the sheet's close button in the top-right corner. */}
      <CampaignReportPage headerClassName="pr-8" backPath={editorPath} />
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
