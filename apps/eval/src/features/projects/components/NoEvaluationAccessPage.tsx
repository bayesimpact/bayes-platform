import { Trans } from "@lingui/react/macro"
import { LockIcon, LogOutIcon } from "lucide-react"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth/session"

/** What a signed-in person sees when no project lets them evaluate its agents. */
export function NoEvaluationAccessPage() {
  return (
    <StatusPage
      icon={<LockIcon aria-hidden />}
      title={<Trans>You cannot evaluate agents yet</Trans>}
      description={
        <Trans>
          Evaluation opens to the evaluators of a project. Ask a project admin to give you the
          Evaluator role from the members page.
        </Trans>
      }
      action={
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOutIcon data-icon="inline-start" aria-hidden />
          <Trans>Sign out</Trans>
        </Button>
      }
    />
  )
}
