import { Button } from "@caseai-connect/ui/shad/button"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { RouteNames } from "./helpers"

export function NotFoundRoute() {
  const { t } = useTranslation("status", { keyPrefix: "notFound" })
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
      <p className="text-lg text-center mb-8">{t("description")}</p>
      <Button asChild>
        <Link to={RouteNames.HOME}>
          <span className="capitalize-first">{t("home")}</span>
        </Link>
      </Button>
    </div>
  )
}
