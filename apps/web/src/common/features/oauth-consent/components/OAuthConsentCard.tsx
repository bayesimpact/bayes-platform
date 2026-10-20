import { useValue } from "@/common/hooks/use-value"
import type { OAuthAuthorizationRequest } from "../oauth-consent.models"
import { selectOAuthConsentPage } from "../oauth-consent.selectors"
import { AppOAuthConsent } from "./AppOAuthConsent"
import { McpOAuthConsent } from "./McpOAuthConsent"

/** An app installs on one workspace as its own account; an MCP client acts as the person. */
export function OAuthConsentCard({ request }: { request: OAuthAuthorizationRequest }) {
  const page = useValue(selectOAuthConsentPage)
  if (page.client.kind === "app") return <AppOAuthConsent request={request} />
  return <McpOAuthConsent request={request} />
}
