import { createContext } from "react"

/**
 * The key under which a `SidePanel` keeps the width the person gave it in `localStorage`. The
 * shell of an app provides its own key, so the apps that share a browser origin keep one width
 * each. Without a provider, the panel uses the default key.
 */
export const SidePanelStorageKeyContext = createContext<string>("sidePanelWidth")
