import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import App from "@/App.tsx"
import { store } from "@/common/store/index.ts"
import { AuthProvider } from "./auth-stub"
import { harnessState } from "./harness-state"
import "@/i18n"
import "./harness.css"

harnessState.store = store

// /harness opens the scenario's own page, keeping the query string.
if (window.location.pathname === "/harness") {
  window.history.replaceState(null, "", `${harnessState.scenarioPath}${window.location.search}`)
}

// Same tree as src/main.tsx. StrictMode is off unless ?strict=1, because its double mount
// hides timing bugs that production builds hit.
const root = document.getElementById("root")
if (!root) throw new Error("Missing #root")
const tree = (
  <Provider store={store}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </Provider>
)
const strict = new URLSearchParams(window.location.search).get("strict") === "1"
createRoot(root).render(strict ? <StrictMode>{tree}</StrictMode> : tree)
