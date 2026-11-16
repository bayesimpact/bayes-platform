import { useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { appBasePath } from "@/app/config"

/** The install's logo, from its theme files, and the app's name, linking to its home. */
export function AppLogo() {
  const { t } = useLingui()
  return (
    <Link
      to="/"
      aria-label={t`Home of Evaluation`}
      className="flex h-12 w-fit items-center gap-2 px-2"
    >
      <img src={`${appBasePath}theme/logo.svg`} alt="" className="h-7 w-auto" />
      <span className="text-2xl font-semibold tracking-tight">
        {t({ message: "Evaluation", comment: "The name of the app, next to the logo" })}
      </span>
    </Link>
  )
}
