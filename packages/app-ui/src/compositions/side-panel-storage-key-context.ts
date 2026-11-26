import { createContext } from "react"

/**
 * The key under which a `SidePanel` keeps the width the person gave it. Each app's shell provides
 * its own (`desk.sidePanelWidth`, `eval.sidePanelWidth`), so a width saved before the panel moved
 * here is found again.
 */
export const SidePanelStorageKeyContext = createContext<string>("sidePanelWidth")
