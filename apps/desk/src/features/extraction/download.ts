/** Saves a text as a file of the person's downloads, as the browser does for a link. */
export function downloadText(text: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  // The browser has read the URL once the click is over.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
