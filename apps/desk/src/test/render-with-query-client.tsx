import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"
import { createQueryClient } from "@/app/query-client"
import { Toaster } from "@/components/ui/sonner"
import { renderWithI18n } from "./render-with-i18n"

/** The params of a conversation that exists nowhere, for a component that only sends requests. */
export function randomConversationParams() {
  return {
    organizationId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    agentId: crypto.randomUUID(),
    agentSessionId: crypto.randomUUID(),
  }
}

/** Renders a component with the app's query client, as `renderWithI18n` does, and its toasts. */
export function renderWithQueryClient(ui: ReactElement) {
  return renderWithI18n(
    <QueryClientProvider client={createQueryClient({ isRetrying: false })}>
      {ui}
      <Toaster />
    </QueryClientProvider>,
  )
}
