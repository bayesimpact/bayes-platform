import { allowedDocumentUploadMimeTypesForFileUploader } from "@caseai-connect/api-contracts"
import { Input } from "@caseai-connect/ui/shad/input"
import { Label } from "@caseai-connect/ui/shad/label"
import { RadioGroup, RadioGroupItem } from "@caseai-connect/ui/shad/radio-group"
import { FileIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FileUploader } from "@/common/components/FileUploader"
import { useAppDispatch } from "@/common/store/hooks"
import type { Resource } from "../resource-libraries.models"
import { uploadResourceFile } from "../resource-libraries.thunks"

export function ResourceLinkField({
  resource,
  onChange,
}: {
  resource: Resource
  onChange: (resource: Resource) => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const setLinkType = (linkType: "url" | "file") => {
    if (linkType === "url") {
      onChange({ ...resource, linkType: "url", file: undefined })
    } else {
      onChange({ ...resource, linkType: "file", url: undefined })
    }
  }

  const handleUpload = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const uploadedFile = await dispatch(uploadResourceFile({ file })).unwrap()
    onChange({ ...resource, linkType: "file", url: undefined, file: uploadedFile })
  }

  return (
    <div className="flex flex-col gap-2">
      <RadioGroup
        className="flex gap-4"
        value={resource.linkType}
        onValueChange={(value) => setLinkType(value as "url" | "file")}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="url" id={`${resource.id}-url`} />
          <Label htmlFor={`${resource.id}-url`}>{t("resourceLibrary:link.url")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="file" id={`${resource.id}-file`} />
          <Label htmlFor={`${resource.id}-file`}>{t("resourceLibrary:link.file")}</Label>
        </div>
      </RadioGroup>

      {resource.linkType === "url" ? (
        <Input
          type="url"
          placeholder={t("resourceLibrary:link.urlPlaceholder")}
          value={resource.url ?? ""}
          onChange={(event) => onChange({ ...resource, url: event.target.value })}
        />
      ) : (
        <div className="flex items-center gap-3">
          <FileUploader
            allowedMimeTypes={allowedDocumentUploadMimeTypesForFileUploader}
            maxSize={25 * 1024 * 1024}
            onProcessFiles={handleUpload}
          />
          {resource.file && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <FileIcon className="size-4" />
              {resource.file.fileName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
