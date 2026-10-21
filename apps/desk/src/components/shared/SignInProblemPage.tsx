import type { SignInRefusal } from "@caseai-connect/desk-contracts"
import { Trans } from "@lingui/react/macro"
import { LogOutIcon, RotateCcwIcon, ShieldAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth/session"
import { StatusPage } from "./StatusPage"

/** Why the person cannot get in: a refusal of the API, a loop, a lost or a refused sign-in. */
export type SignInProblem = SignInRefusal | "loop" | "lostState" | "providerRefused"

export type SignInProblemPageProps = {
  problem: SignInProblem
  /** The provider's own words, for a refusal it explains: support reads them. */
  detail?: string | null
  onRetry: () => void
}

const TEXTS: Record<SignInProblem, { title: ReactNode; message: ReactNode; hint: ReactNode }> = {
  emailNotVerified: {
    title: <Trans>Verify your email</Trans>,
    message: (
      <Trans>
        An account is waiting for your email address, but your identity provider has not verified it
        yet.
      </Trans>
    ),
    hint: (
      <Trans>
        Open the verification email your identity provider sent you, and check your spam folder.
        Click the link it contains, then try again.
      </Trans>
    ),
  },
  emailRequired: {
    title: <Trans>Email address missing</Trans>,
    message: <Trans>Your identity provider did not share your email address with the Desk.</Trans>,
    hint: <Trans>The Desk needs it to find your invitations. Contact your administrator.</Trans>,
  },
  emailLinkingDisabled: {
    title: <Trans>Account already exists</Trans>,
    message: (
      <Trans>
        An account already exists for your email address, and this platform does not link a new
        sign-in to an existing account.
      </Trans>
    ),
    hint: <Trans>Contact your administrator.</Trans>,
  },
  loop: {
    title: <Trans>The sign-in keeps failing</Trans>,
    message: <Trans>Each new sign-in ended at once, so the Desk stopped starting new ones.</Trans>,
    hint: (
      <Trans>Try again in a moment. If this page comes back, sign out, then sign in again.</Trans>
    ),
  },
  lostState: {
    title: <Trans>Sign-in expired</Trans>,
    message: (
      <Trans>
        This sign-in started too long ago, or another tab started a new one, and this tab can no
        longer complete it.
      </Trans>
    ),
    hint: (
      <Trans>
        Try again to sign in. If this page comes back, close the other tabs of the Desk.
      </Trans>
    ),
  },
  providerRefused: {
    title: <Trans>Sign-in failed</Trans>,
    message: <Trans>Your identity provider refused the sign-in.</Trans>,
    hint: <Trans>If it keeps happening, contact your administrator with the message below.</Trans>,
  },
}

/**
 * Explains why the person cannot get in, with what to do next, a new try and a way out: the Desk
 * never sends them back to the provider on its own from here.
 */
export function SignInProblemPage({ problem, detail = null, onRetry }: SignInProblemPageProps) {
  const text = TEXTS[problem]
  return (
    <StatusPage
      icon={<ShieldAlertIcon aria-hidden />}
      title={text.title}
      description={
        <span className="flex flex-col gap-2">
          <span className="text-foreground">{text.message}</span>
          <span>{text.hint}</span>
          {detail ? (
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs break-words">
              {detail}
            </code>
          ) : null}
        </span>
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry}>
            <RotateCcwIcon aria-hidden />
            <Trans>Try again</Trans>
          </Button>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOutIcon aria-hidden />
            <Trans>Sign out</Trans>
          </Button>
        </div>
      }
    />
  )
}
