import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Toaster } from "@/common/components/Sonner"
import { resolveNotificationText } from "@/common/features/notifications/notifications.helpers"
import { selectLastNotification } from "@/common/features/notifications/notifications.selectors"
import { useInitApi } from "@/common/hooks/use-init-api"
import { Router } from "@/common/routes/Router"
import { useAppSelector } from "@/common/store/hooks"

function App() {
  useInitApi()
  return (
    <>
      <NotificationCenter />
      <Router />
    </>
  )
}

export default App

function NotificationCenter() {
  const { t } = useTranslation()
  const notification = useAppSelector(selectLastNotification)
  // `t` changes with the language: remember the last toast so it is not shown twice.
  const lastShownId = useRef<string | null>(null)

  useEffect(() => {
    if (!notification || notification.id === lastShownId.current) return
    lastShownId.current = notification.id
    const { title, description } = resolveNotificationText(notification, (key, values) =>
      t(key, values),
    )
    if (description) {
      toast[notification.type](
        <div>
          <strong>{title}</strong>
          <div>{description}</div>
        </div>,
      )
    } else toast[notification.type](title)
    // TODO: Dispatch reset action after showing the notification
  }, [notification, t])

  return <Toaster />
}
