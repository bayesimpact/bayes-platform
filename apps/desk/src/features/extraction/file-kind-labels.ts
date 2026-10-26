import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import type { FileKind } from "./extraction-files"

/** What each kind of document is called, in a document's row and in its details. */
export const FILE_KIND_LABELS = {
  pdf: msg({ message: "PDF", comment: "The kind of a document the person uploaded" }),
  image: msg({ message: "Image", comment: "The kind of a document the person uploaded" }),
  text: msg({ message: "Text", comment: "The kind of a document the person uploaded" }),
  csv: msg({ message: "CSV", comment: "The kind of a document the person uploaded" }),
  other: msg({ message: "File", comment: "The kind of a document the person uploaded" }),
} satisfies Record<FileKind, MessageDescriptor>
