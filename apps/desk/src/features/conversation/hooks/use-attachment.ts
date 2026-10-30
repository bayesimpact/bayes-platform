import { ATTACHMENT_MAX_BYTES, presignAttachmentInputSchema } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { useState } from "react"
import { toast } from "sonner"
import { fileSizeOf } from "@/lib/file-size"

/** Why a file cannot be attached. */
type AttachmentProblem = "type" | "empty" | "size"

/** Why the contract refuses a file before its upload, or `null` when it takes it. */
function attachmentProblemOf(file: File): AttachmentProblem | null {
  const { mimeType, size } = presignAttachmentInputSchema.shape
  if (!mimeType.safeParse(file.type).success) return "type"
  if (file.size === 0) return "empty"
  if (!size.safeParse(file.size).success) return "size"
  return null
}

/** The types of file the picker offers, as its `accept` attribute reads them. */
const ACCEPTED_TYPES = presignAttachmentInputSchema.shape.mimeType.options.join(",")

/**
 * The file attached to the message being written: a picked file the contract takes, or a toast
 * that says why it does not.
 */
export function useAttachment() {
  const { t, i18n } = useLingui()
  const [file, setFile] = useState<File | null>(null)

  const pick = (picked: File) => {
    const problem = attachmentProblemOf(picked)
    if (problem === null) {
      setFile(picked)
      return
    }
    const maxSize = fileSizeOf(ATTACHMENT_MAX_BYTES, i18n.locale)
    const messages: Record<AttachmentProblem, string> = {
      type: t`Attach a PDF, PNG or JPEG file.`,
      empty: t`This file is empty.`,
      size: t`Attach a file of ${maxSize} at most.`,
    }
    toast.error(messages[problem])
  }

  return { file, accept: ACCEPTED_TYPES, pick, clear: () => setFile(null) }
}
