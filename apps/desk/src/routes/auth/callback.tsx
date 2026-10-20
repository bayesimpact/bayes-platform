import { Trans } from "@lingui/react/macro"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { LogInIcon } from "lucide-react"
import { appBasePath } from "@/app/config"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button } from "@/components/ui/button"
import { completeSignIn, signIn, takeTabReturnTo } from "@/lib/auth/session"

/** Where the identity provider sends the person back: completes the sign-in, then opens their page. */
export const Route = createFileRoute("/auth/callback")({
  beforeLoad: async () => {
    const returnTo = await completeSignIn()
    throw redirect({ href: returnTo, replace: true })
  },
  errorComponent: SignInErrorPage,
})

/** The sign-in state was lost or refused: start again from the page this tab was on. */
function SignInErrorPage() {
  const handleSignIn = () => void signIn({ returnTo: takeTabReturnTo() ?? appBasePath })
  return (
    <StatusPage
      icon={<LogInIcon aria-hidden />}
      title={<Trans>The sign-in did not complete</Trans>}
      description={<Trans>Sign in again to open the Desk.</Trans>}
      action={
        <Button onClick={handleSignIn}>
          <Trans>Sign in again</Trans>
        </Button>
      }
    />
  )
}
