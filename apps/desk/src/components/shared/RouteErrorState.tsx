import { Trans } from "@lingui/react/macro"
import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContractMismatchError } from "@/lib/api-client"
import { StatusPage } from "./StatusPage"

/**
 * The error component of a route: its retry resets the failed queries and runs the loaders again.
 * When this tab runs another version than the API, it offers to reload the page instead.
 */
export function RouteErrorState({ error }: ErrorComponentProps) {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  if (error instanceof ContractMismatchError) {
    return (
      <StatusPage
        icon={<RefreshCwIcon aria-hidden />}
        title={<Trans>A new version of the Desk is available</Trans>}
        description={<Trans>Reload the page to keep going.</Trans>}
        action={
          <Button onClick={() => window.location.reload()}>
            <Trans>Reload</Trans>
          </Button>
        }
      />
    )
  }

  const handleRetry = () => {
    queryErrorResetBoundary.reset()
    void router.invalidate()
  }

  return (
    <StatusPage
      icon={<TriangleAlertIcon aria-hidden />}
      title={<Trans>This page could not load</Trans>}
      description={<Trans>Check your connection, then try again.</Trans>}
      action={
        <Button onClick={handleRetry}>
          <Trans>Try again</Trans>
        </Button>
      }
    />
  )
}
