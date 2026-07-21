export const DOC_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
])

export const DOCLING_SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  ...DOC_MIME_TYPES,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/tiff",
  "image/bmp",
  "image/webp",
])

export const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
  "image/webp": "webp",
}
