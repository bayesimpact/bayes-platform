import type { OpenedResource } from "@caseai-connect/chat"
import { useState } from "react"

/** A panel a button of the header opens and closes. */
type ToggledPanel = "forms"

/**
 * The panel docked beside the conversation, as an artifact in the Claude app: the forms or
 * a resource a reply points to, one at a time, or none.
 */
export function useConversationPanel() {
  const [openPanel, setOpenPanel] = useState<ToggledPanel | OpenedResource | null>(null)
  return {
    isFormsOpen: openPanel === "forms",
    openedResource: typeof openPanel === "object" ? openPanel : null,
    toggle: (panel: ToggledPanel) => setOpenPanel((current) => (current === panel ? null : panel)),
    openResource: (resource: OpenedResource) => setOpenPanel(resource),
    close: () => setOpenPanel(null),
  }
}
