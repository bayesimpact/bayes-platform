import { Auth0Provider } from "@auth0/auth0-react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import App from "./App.tsx"
import { RouteNames } from "./common/routes/helpers.ts"
import { store } from "./common/store/index.ts"
import { auth0ProviderConfig } from "./config/auth0.config.ts"
import "./i18n"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <Auth0Provider
        {...auth0ProviderConfig}
        // Auth0 also uses ?code=&state= in its callbacks, so by default the SDK
        // consumes those params on ANY page load. The MCP OAuth callback carries
        // a third-party code/state pair that must reach our own handler intact.
        skipRedirectCallback={window.location.pathname === RouteNames.MCP_OAUTH_CALLBACK}
      >
        <App />
      </Auth0Provider>
    </Provider>
  </StrictMode>,
)
