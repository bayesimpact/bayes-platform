import { useLingui } from "@lingui/react/macro"
import { appBasePath, platformHomePath } from "@/app/config"

/**
 * The install's logo, from its theme files, and the app's name, at the top of the app's home. It
 * leads back to the platform's home, the page of apps/web that lists the person's apps: a plain
 * link, since that page is outside this app.
 */
export function AppLogo() {
  const { t } = useLingui()
  return (
    <a
      href={platformHomePath}
      aria-label={t`Back to home`}
      className="flex h-12 w-fit items-center gap-2 px-2"
    >
      <img src={`${appBasePath}theme/logo.svg`} alt="" className="h-7 w-auto" />
      <span className="text-2xl font-semibold tracking-tight">
        {t({ message: "Evaluation", comment: "The name of the app, next to the logo" })}
      </span>
    </a>
  )
}
