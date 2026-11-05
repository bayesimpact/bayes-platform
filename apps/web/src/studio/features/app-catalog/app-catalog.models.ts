/** An app of the studio's catalog, as the current project sees it. */
export type AppCatalogEntry = {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  /** Where installation starts: the flow is app-initiated. */
  appUrl: string | null
  installInstructions: string | null
  installed: boolean
}
