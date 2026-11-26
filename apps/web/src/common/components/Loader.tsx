import { Item, ItemHeader, ItemTitle } from "@bayes-platform/ui/shad/item"
import { Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
export function Loader() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 items-center justify-center">
      <Item variant="outline" className="w-fit animate-pulse">
        <ItemHeader>
          <ItemTitle className="w-fit text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin capitalize-first" /> {t("status:loading")}
          </ItemTitle>
        </ItemHeader>
      </Item>
    </div>
  )
}
