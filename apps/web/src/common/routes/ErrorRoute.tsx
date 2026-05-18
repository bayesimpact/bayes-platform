import { Button } from "@caseai-connect/ui/shad/button"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { RouteNames } from "./helpers"

export function ErrorRoute({ error }: { error: string }) {
  const { t } = useTranslation("status", { keyPrefix: "notFound" })
  console.error("Error route:", error)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <p className="text-4xl font-bold text-center mb-4">Oops!</p>
      <p className="text-xl text-center mb-4">{error}</p>
      <Button asChild>
        <Link to={RouteNames.HOME}>
          <span className="capitalize-first">{t("home")}</span>
        </Link>
      </Button>
    </div>
  )
}
