import type { McpAppHtmlOutputDto } from "@caseai-connect/desk-contracts"
import type { ChatMcpApp } from "./chat-messages"

/**
 * The HTML of an app: the first one of its resource, from its server, or from any server for a
 * pointer saved before servers were named. `null` when the API sent none.
 */
export function findMcpAppHtml(app: ChatMcpApp, htmls: McpAppHtmlOutputDto[]): string | null {
  const match = htmls.find(
    (entry) =>
      entry.resourceUri === app.resourceUri &&
      (app.mcpServerId === null || entry.mcpServerId === app.mcpServerId) &&
      entry.html.trim() !== "",
  )
  return match?.html ?? null
}

/**
 * The message box once an app put its text in it: after what the person already wrote, as a
 * paragraph of its own, so an app never erases their words.
 */
export function withAppMessage(draft: string, text: string): string {
  return draft.trim() === "" ? text : `${draft.trimEnd()}\n\n${text}`
}

/** Whether a reply's text says something: a lone "." beside a card says nothing. */
export function hasMeaningfulText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text)
}

/** The HTML of a conversation's apps, and whether it is still on its way. */
export type AppsHtml = {
  htmls: McpAppHtmlOutputDto[]
  isPending: boolean
}

/** The apps of a reply that show no card: they failed, or the API sent no HTML for them. */
export function unavailableApps(
  apps: ChatMcpApp[],
  appsHtml: AppsHtml,
  failedAppIds: string[],
): ChatMcpApp[] {
  return apps.filter(
    (app) =>
      failedAppIds.includes(app.toolCallId) ||
      (!appsHtml.isPending && findMcpAppHtml(app, appsHtml.htmls) === null),
  )
}
