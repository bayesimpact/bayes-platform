export type McpServerDisplay = {
  id: string
  name: string
  url: string
  /** Null for built-in servers, which are visible in every project. */
  projectId: string | null
  isBuiltIn: boolean
  createdAt: number
  updatedAt: number
}
