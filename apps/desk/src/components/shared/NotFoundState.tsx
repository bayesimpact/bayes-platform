import { Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { SearchXIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { StatusPage } from "./StatusPage"

export function NotFoundState() {
  return (
    <StatusPage
      icon={<SearchXIcon aria-hidden />}
      title={<Trans>Page not found</Trans>}
      description={<Trans>This page does not exist, or you cannot open it.</Trans>}
      action={
        <Link to="/" className={buttonVariants()}>
          <Trans>Back to the Desk</Trans>
        </Link>
      }
    />
  )
}
