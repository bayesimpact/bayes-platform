export type ToolExecutionLog = {
  toolName: string
  notifyToolName?: string
  arguments: Record<string, unknown>
}
