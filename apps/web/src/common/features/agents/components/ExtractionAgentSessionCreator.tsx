import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Item, ItemContent } from "@caseai-connect/ui/shad/item"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { InfoIcon, PlusCircleIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FileUploader } from "@/common/components/FileUploader"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { Document } from "@/studio/features/documents/documents.models"
import {
  selectIsProcessingExecution,
  selectLastExtractionSession,
} from "../agent-sessions/extraction/extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "../agent-sessions/extraction/extraction-agent-sessions.slice"
import { DocumentList } from "./DocumentList"
import { ExtractionSessionItem } from "./ExtractionAgentSessionItem"

export function ExtractionSessionCreator({
  disabled,
  onSuccess,
  buttonText,
}: {
  buttonText: string
  disabled?: boolean
  onSuccess: () => void
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  const isProcessingExecution = useAppSelector(selectIsProcessingExecution)
  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
    onSuccess()
  }

  const handleSubmit = async (data: { file: File } | { document: Document }) => {
    if (!data) return
    dispatch(extractionAgentSessionsActions.executeOne({ ...data, onSuccess: handleSuccess }))
  }

  const handleDismiss = (e: { preventDefault: () => void }) => {
    if (isProcessingExecution) {
      e.preventDefault()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="text-base" disabled={isProcessingExecution || disabled}>
          {buttonText}
          <PlusCircleIcon className="ml-2 size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="min-w-fit"
        showCloseButton={!isProcessingExecution}
        onEscapeKeyDown={handleDismiss}
        onPointerDownOutside={handleDismiss}
      >
        <div className="flex pr-6 gap-12 items-center">
          <DialogHeader className="flex-1">
            <DialogTitle>{t("extractionAgentSession:create.title")}</DialogTitle>
            <DialogDescription>{t("extractionAgentSession:create.description")}</DialogDescription>
          </DialogHeader>

          <FileUploader
            disabled={isProcessingExecution}
            maxFiles={1}
            allowedMimeTypes={{
              "application/pdf": true,
              "image/jpeg": true,
            }}
            onDropFiles={(files) => {
              const file = files[0]
              if (!file) return
              handleSubmit({ file })
            }}
          />
        </div>

        {isProcessingExecution ? (
          <Item variant="muted">
            <Spinner />
            <ItemContent>{t("extractionAgentSession:create.processingMessage")}</ItemContent>
          </Item>
        ) : (
          <DocumentList onSelectDocument={(document) => handleSubmit({ document })} />
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ExtractionSessionCreatorWithLastSession({
  buttonText,
  disabled,
}: {
  buttonText: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <ExtractionSessionCreator
        buttonText={buttonText}
        disabled={disabled}
        onSuccess={() => setOpen(true)}
      />
      {<LastExtraction open={open} setOpen={setOpen} />}
    </>
  )
}

function LastExtraction({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const lastExtraction = useAppSelector(selectLastExtractionSession)
  const { t } = useTranslation()

  if (!lastExtraction) return null
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="min-w-fit">
        <ExtractionSessionItem
          className="p-0"
          key={lastExtraction.id}
          agentSession={lastExtraction}
          canDelete={false}
        />

        <Item variant="muted">
          <InfoIcon />
          <ItemContent>{t("extractionAgentSession:lastExtraction.info")}</ItemContent>
        </Item>
      </DialogContent>
    </Dialog>
  )
}
