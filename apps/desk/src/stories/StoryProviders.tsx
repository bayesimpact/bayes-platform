import { I18nProvider } from "@lingui/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { i18n } from "@/app/i18n"
import { createQueryClient } from "@/app/query-client"

export type StoryProvidersProps = {
  children: ReactNode
}

/**
 * What a story of one component needs around it, which the whole Desk brings itself: the language
 * of the toolbar, and a cache of its own on the mocked API, whose queries do not retry.
 */
export function StoryProviders({ children }: StoryProvidersProps) {
  const [queryClient] = useState(() => createQueryClient({ isRetrying: false }))
  return (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nProvider>
  )
}
