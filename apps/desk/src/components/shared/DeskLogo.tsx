import { useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { appBasePath } from "@/app/config"

/** The product's name, which no language translates. */
const PRODUCT_NAME = "Desk"

/** The install's logo, from its theme files, and the product's name, linking to the Desk's home. */
export function DeskLogo() {
  const { t } = useLingui()
  return (
    <Link
      to="/"
      aria-label={t`Home of the Desk`}
      className="flex h-12 w-fit items-center gap-2 px-2"
    >
      <img src={`${appBasePath}theme/logo.svg`} alt="" className="h-7 w-auto" />
      <span className="text-2xl font-semibold tracking-tight">{PRODUCT_NAME}</span>
    </Link>
  )
}
