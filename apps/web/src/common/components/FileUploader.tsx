import type { AllowedMimeTypes } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { cn } from "@caseai-connect/ui/utils"
import { Loader2Icon, UploadCloudIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useTranslation } from "react-i18next"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { useAppDispatch } from "@/common/store/hooks"

type UploaderProps = {
  allowedMimeTypes: Partial<Record<(typeof AllowedMimeTypes)[number], boolean>>
  className?: string
  maxFiles?: number
  onDropFiles?: (files: File[]) => void
  onProcessFiles?: (files: File[]) => Promise<void>
  onProcessEnd?: (status: "error" | "success") => void
  startProcessingFiles?: boolean
  disabled?: boolean
  maxSize?: number
  noClick?: boolean
}

export function FileUploader({
  onDropFiles,
  allowedMimeTypes,
  children,
  className,
  maxFiles = 1,
  onProcessFiles,
  onProcessEnd,
  startProcessingFiles = true, // NOTE: trigger to start processing files. Easier than using a ref to control when to process after files are dropped.
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled: disabledProp,
  noClick = false,
}: UploaderProps & { children?: React.ReactNode }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation("actions")
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<"loading" | "error" | "success">()

  const disabled = disabledProp || status === "loading"

  const showNotification = useCallback(
    (type: "info" | "error", title: string) =>
      // tiemout required
      setTimeout(() => {
        dispatch(notificationsActions.show({ type, title }))
      }, 0),
    [dispatch],
  )

  const handleFiles = useCallback(
    async (files: File[]) => {
      try {
        setStatus("loading")
        await onProcessFiles?.(files).finally(() => {
          setStatus(undefined)
          setFiles([])
          onProcessEnd?.("success")
        })
      } catch (error) {
        console.error(error)
        setStatus("error")
        onProcessEnd?.("error")
      }
    },
    [onProcessFiles, onProcessEnd],
  )

  useEffect(() => {
    if (!startProcessingFiles) return
    if (files.length === 0) return

    if (onProcessFiles) handleFiles(files)
  }, [startProcessingFiles, files, handleFiles, onProcessFiles])

  const { getRootProps, getInputProps } = useDropzone({
    accept: buildAccept(allowedMimeTypes),
    maxSize,
    onError: (err) => {
      console.error(err)
    },
    onDropAccepted: (files) => {
      setFiles(files)
      onDropFiles?.(files)
    },
    onDropRejected: (fileRejections) => {
      fileRejections.forEach((rejection) => {
        rejection.errors.forEach((err) => {
          switch (err.code) {
            case "file-invalid-type":
              showNotification(
                "error",
                t("fileInvalidType", {
                  fileName: rejection.file.name,
                  fileType: rejection.file.type,
                }),
              )
              break

            case "too-many-files":
              showNotification("error", t("fileTooMany", { maxFiles }))
              break

            case "file-too-large":
              showNotification("error", t("fileTooLarge", { fileName: rejection.file.name }))
              break

            case "file-too-small":
              showNotification("error", t("fileTooSmall", { fileName: rejection.file.name }))
              break

            default:
              showNotification(
                "error",
                t("fileUploadFailed", { fileName: rejection.file.name, errorMessage: err.message }),
              )
              break
          }
        })
      })
    },
    disabled,
    maxFiles,
    noClick,
  })

  return (
    <div {...getRootProps()} className={cn("w-fit", !children && "cursor-pointer", className)}>
      {children ? (
        children
      ) : (
        <Button className="w-full" disabled={disabled}>
          {disabled ? (
            <Loader2Icon className="size-5 animate-spin" />
          ) : (
            <UploadCloudIcon className="size-5" />
          )}{" "}
          <span className="capitalize-first">{t("dragOrUploadFile")}</span>
        </Button>
      )}
      <input {...getInputProps()} />
    </div>
  )
}

function buildAccept(
  allowedMimeTypes: Partial<Record<(typeof AllowedMimeTypes)[number], boolean>>,
) {
  return Object.keys(allowedMimeTypes)
    .filter((mime) => allowedMimeTypes[mime as (typeof AllowedMimeTypes)[number]])
    .reduce(
      (acc, mime) => {
        acc[mime] = []
        return acc
      },
      {} as Record<string, string[]>,
    )
}
