import type { User } from "oidc-client-ts"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AuthProvider } from "react-oidc-context"
import { Provider } from "react-redux"
import App from "./App.tsx"
import { RouteNames } from "./common/routes/helpers.ts"
import { store } from "./common/store/index.ts"
import { getAppPathname } from "./config/runtime-config.ts"
import { getUserManager, rememberSigninReturnTo } from "./external/oidcClient.ts"
import "./i18n"
import "./index.css"

/** Drops `code` and `state` from the URL once the sign-in is complete. */
function completeSignin(user: User | undefined): void {
  rememberSigninReturnTo(user)
  const url = new URL(window.location.href)
  url.searchParams.delete("code")
  url.searchParams.delete("state")
  url.searchParams.delete("session_state")
  url.searchParams.delete("iss")
  window.history.replaceState(window.history.state, "", url.toString())
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider
        userManager={getUserManager()}
        onSigninCallback={completeSignin}
        // The OIDC callback uses ?code=&state=, so by default the provider
        // consumes those params on ANY page load. The MCP OAuth callback carries
        // a third-party code/state pair that must reach our own handler intact.
        skipSigninCallback={getAppPathname() === RouteNames.MCP_OAUTH_CALLBACK}
      >
        <App />
      </AuthProvider>
    </Provider>
  </StrictMode>,
)
