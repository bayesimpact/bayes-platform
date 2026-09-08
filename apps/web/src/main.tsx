import { type AppState, Auth0Provider } from "@auth0/auth0-react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import App from "./App.tsx"
import { sanitizeReturnTo } from "./common/routes/auth0-return-to.ts"
import { RouteNames } from "./common/routes/helpers.ts"
import { getAppRouter } from "./common/routes/Router.tsx"
import { store } from "./common/store/index.ts"
import { auth0ProviderConfig } from "./config/auth0.config.ts"
import "./i18n"
import "./index.css"

/**
 * Auth0 redirects to the origin after login. Resume on the page the user was
 * on (stored by ProtectedRoute in appState.returnTo) so single-use query
 * params such as the MCP OAuth code and state are not lost on the way back.
 *
 * The SDK default only calls history.replaceState, which react-router does
 * not observe, so navigate through the data router. flushSync commits the new
 * location before the SDK flips isAuthenticated, otherwise HomeRoute would
 * see the authenticated state first and send the user to onboarding.
 *
 * Module-level on purpose: Auth0Provider re-runs its init effect whenever
 * this callback's identity changes.
 */
function onAuth0RedirectCallback(appState?: AppState) {
  const returnTo = sanitizeReturnTo(appState?.returnTo)
  if (returnTo) {
    getAppRouter().navigate(returnTo, { replace: true, flushSync: true })
    return
  }
  window.history.replaceState({}, document.title, window.location.pathname)
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <Auth0Provider
        {...auth0ProviderConfig}
        // Auth0 also uses ?code=&state= in its callbacks, so by default the SDK
        // consumes those params on ANY page load. The MCP OAuth callback carries
        // a third-party code/state pair that must reach our own handler intact.
        skipRedirectCallback={window.location.pathname === RouteNames.MCP_OAUTH_CALLBACK}
        onRedirectCallback={onAuth0RedirectCallback}
      >
        <App />
      </Auth0Provider>
    </Provider>
  </StrictMode>,
)
