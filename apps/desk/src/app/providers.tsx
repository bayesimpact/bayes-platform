import { I18nProvider } from "@lingui/react"
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { i18n } from "./i18n"
import type { createAppRouter } from "./router"

export type AppProvidersProps = {
  queryClient: QueryClient
  router: ReturnType<typeof createAppRouter>
}

export function AppProviders({ queryClient, router }: AppProvidersProps) {
  return (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>
  )
}
