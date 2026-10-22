import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import { LogOutIcon, RotateCcwIcon, ShieldAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type SignInProblem, signOut } from "@/lib/auth/session"
import { StatusPage } from "./StatusPage"

export type SignInProblemPageProps = {
  problem: SignInProblem
  /** The provider's own words, for a refusal it explains: support reads them. */
  detail?: string
  onRetry: () => void
}

type ProblemTexts = {
  title: MessageDescriptor
  message: MessageDescriptor
  hint: MessageDescriptor
}

const TEXTS = {
  emailNotVerified: {
    title: msg`Verify your email`,
    message: msg`An account is waiting for your email address, but your identity provider has not verified it yet.`,
    hint: msg`Open the verification email your identity provider sent you, and check your spam folder. Click the link it contains, then try again.`,
  },
  emailRequired: {
    title: msg`Email address missing`,
    message: msg`Your identity provider did not share your email address with the Desk.`,
    hint: msg`The Desk needs it to find your invitations. Contact your administrator.`,
  },
  emailLinkingDisabled: {
    title: msg`Account already exists`,
    message: msg`An account already exists for your email address, and this platform does not link a new sign-in to an existing account.`,
    hint: msg`Contact your administrator.`,
  },
  loop: {
    title: msg`The sign-in keeps failing`,
    message: msg`Each new sign-in ended at once, so the Desk stopped starting new ones.`,
    hint: msg`Try again in a moment. If this page comes back, sign out, then sign in again.`,
  },
  lostState: {
    title: msg`Sign-in expired`,
    message: msg`This sign-in started too long ago, or another tab started a new one, and this tab can no longer complete it.`,
    hint: msg`Try again to sign in. If this page comes back, close the other tabs of the Desk.`,
  },
  providerRefused: {
    title: msg`Sign-in failed`,
    message: msg`Your identity provider refused the sign-in.`,
    hint: msg`If it keeps happening, contact your administrator with the message below.`,
  },
} as const satisfies Record<SignInProblem, ProblemTexts>

/**
 * Explains why the person cannot get in, with what to do next, a new try and a way out: the Desk
 * never sends them back to the provider on its own from here.
 */
export function SignInProblemPage({ problem, detail, onRetry }: SignInProblemPageProps) {
  const { i18n } = useLingui()
  const text = TEXTS[problem]
  return (
    <StatusPage
      icon={<ShieldAlertIcon aria-hidden />}
      title={i18n._(text.title)}
      description={
        <span className="flex flex-col gap-2">
          <span className="text-foreground">{i18n._(text.message)}</span>
          <span>{i18n._(text.hint)}</span>
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
