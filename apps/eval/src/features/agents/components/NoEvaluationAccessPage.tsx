import { Trans } from "@lingui/react/macro"
import { cn } from "cn"
import { HouseIcon, LockIcon, LogOutIcon } from "lucide-react"
import { platformHomePath } from "@/app/config"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button, buttonVariants } from "@/components/ui/button"
import { signOut } from "@/lib/auth/session"

/** What a signed-in person sees when no project lets them evaluate its agents. */
export function NoEvaluationAccessPage() {
  return (
    <StatusPage
      icon={<LockIcon aria-hidden />}
      title={<Trans>You have no access to Evaluation yet</Trans>}
      description={
        <Trans>
          Evaluation opens to the evaluators and the admins of a project, and to the testers and
          reviewers of a review campaign. Ask a project admin to give you access.
        </Trans>
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {/* Another app of the platform: a plain link, which leaves the app's router. */}
          <a href={platformHomePath} className={cn(buttonVariants())}>
            <HouseIcon data-icon="inline-start" aria-hidden />
            <Trans comment="Opens the platform's home, which lists the person's apps">
              Back to home
            </Trans>
          </a>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOutIcon data-icon="inline-start" aria-hidden />
            <Trans>Sign out</Trans>
          </Button>
        </div>
      }
    />
  )
}
