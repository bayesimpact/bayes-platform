import { useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { appBasePath } from "@/app/config"

/** The install's logo, from its theme files, linking to the Desk's home. */
export function DeskLogo() {
  const { t } = useLingui()
  return (
    <Link to="/" className="flex h-12 items-center px-2">
      <img src={`${appBasePath}theme/logo.svg`} alt={t`Home of the Desk`} className="h-7 w-auto" />
    </Link>
  )
}
