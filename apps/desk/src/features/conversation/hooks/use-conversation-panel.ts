import { useState } from "react"
import type { OpenedResource } from "../resource-media"

/** A panel a button of the header opens and closes. */
type ToggledPanel = "memory" | "forms"

/**
 * The panel docked beside the conversation, as an artifact in the Claude app: the memory, the
 * forms or a resource a reply points to, one at a time, or none.
 */
export function useConversationPanel() {
  const [openPanel, setOpenPanel] = useState<ToggledPanel | OpenedResource | null>(null)
  return {
    isMemoryOpen: openPanel === "memory",
    isFormsOpen: openPanel === "forms",
    openedResource: typeof openPanel === "object" ? openPanel : null,
    toggle: (panel: ToggledPanel) => setOpenPanel((current) => (current === panel ? null : panel)),
    openResource: (resource: OpenedResource) => setOpenPanel(resource),
    close: () => setOpenPanel(null),
  }
}
