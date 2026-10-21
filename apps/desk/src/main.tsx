import "./styles/global.css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { activateLocale, detectLocale } from "./app/i18n"
import { AppProviders } from "./app/providers"
import { createQueryClient } from "./app/query-client"
import { createAppRouter } from "./app/router"
import { onSessionEnded } from "./lib/auth/session"

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

// A session that ends (sign-out, a failed refresh, another tab) takes its data with it.
onSessionEnded(() => {
  queryClient.clear()
  void router.invalidate()
})

await activateLocale(detectLocale())

const rootElement = document.getElementById("root")
if (!rootElement) throw new Error("index.html has no #root element")
createRoot(rootElement).render(
  <StrictMode>
    <AppProviders queryClient={queryClient} router={router} />
  </StrictMode>,
)
