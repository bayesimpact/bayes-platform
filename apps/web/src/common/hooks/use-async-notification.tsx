import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export function useAsyncNotification(asyncFunction: () => Promise<string>) {
  const { t } = useTranslation("status")

  const showAsyncNotification = async () => {
    toast.promise<string>(
      async () => {
        const response = await asyncFunction()
        return response
      },
      {
        loading: t("asyncLoading"),
        success: (data: string) => data,
        error: (error: {
          response?: { data?: { statusCode?: number; message?: string } }
          message?: string
        }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {t("asyncError", { statusCode: error.response?.data?.statusCode ?? "Unknown" })}
            </span>
            <span className="text-muted-foreground font-normal whitespace-break-spaces">
              {error.response?.data?.message || error.message || t("asyncUnknownError")}
            </span>
          </div>
        ),
      },
    )
  }

  return { showAsyncNotification }
}
