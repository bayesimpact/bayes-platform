"use client"

import { allowedDocumentUploadMimeTypesForFileUploader } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { FieldLabel } from "@caseai-connect/ui/shad/field"
import { XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { FileUploader } from "@/common/components/FileUploader"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  getTagNameById,
  useDocumentTags,
} from "@/studio/features/document-tags/document-tags.helpers"
import { uploadDocuments } from "@/studio/features/documents/documents.thunks"
import { selectUploaderState } from "../documents.selectors"
import { DocumentTagPicker } from "./DocumentTagPicker"

export function UploadDocumentsButton({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const uploaderState = useAppSelector(selectUploaderState)
  const { documentTags } = useDocumentTags()
  const [open, setOpen] = useState(false)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [filesCount, setFilesCount] = useState(0)
  const hasAvailableTags = documentTags.length > 0
  const [startProcessingFiles, setStartProcessingFiles] = useState(!hasAvailableTags)

  const handleAddTag = (tagId: string) => {
    if (!tagIds.includes(tagId)) {
      setTagIds((prev) => [...prev, tagId])
    }
  }

  const handleRemoveTag = (tagId: string) => {
    setTagIds((prev) => prev.filter((id) => id !== tagId))
  }

  const handleDropFiles = async (files: File[]) => {
    setFilesCount(files.length)
    if (hasAvailableTags) setOpen(true)
    else setStartProcessingFiles(true)
  }

  const handleProcessFiles = async (files: File[]) => {
    await dispatch(
      uploadDocuments({
        files,
        sourceType: "project",
        tagIds: tagIds.length > 0 ? tagIds : undefined,
      }),
    ).unwrap()
  }

  const isUploading = uploaderState.status === "uploading"

  const handleConfirmDialog = () => {
    setStartProcessingFiles(true)
    handleClose()
  }

  const handleClose = () => setOpen(false)

  useEffect(() => {
    if (!open) {
      setTagIds([])
      setFilesCount(0)
      setStartProcessingFiles(false)
    }
    return () => {
      // setOpen(false)
    }
  }, [open])

  return (
    <>
      <FileUploader
        className={className}
        allowedMimeTypes={allowedDocumentUploadMimeTypesForFileUploader}
        maxFiles={400}
        disabled={isUploading}
        maxSize={40 * 1024 * 1024} // 40MB
        onDropFiles={handleDropFiles}
        onProcessFiles={handleProcessFiles}
        startProcessingFiles={startProcessingFiles}
        onProcessEnd={handleClose}
        noClick={!!children}
      >
        {children}
      </FileUploader>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("document:upload.tagDialog.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {t("document:upload.tagDialog.description")}
          </p>
          <p className="text-foreground text-sm font-medium">
            {t("document:upload.tagDialog.fileCountSentence", { count: filesCount })}
          </p>
          <div className="flex flex-col gap-2">
            <FieldLabel>{t("document:props.tags")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {tagIds.map((tagId) => (
                <Badge key={tagId} variant="secondary" className="gap-1">
                  {getTagNameById(documentTags, tagId)}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tagId)}
                    className="opacity-60 hover:opacity-100"
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
              <DocumentTagPicker
                documentTags={documentTags}
                attachedTagIds={tagIds}
                onAdd={(tagId) => handleAddTag(tagId)}
              />
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isUploading}>
              {t("actions:cancel")}
            </Button>
            <Button type="button" disabled={isUploading} onClick={handleConfirmDialog}>
              {t("document:upload.tagDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
