import type { NotificationContent, NotificationValues } from "./notifications.models"

type Translate = (key: string, values?: NotificationValues) => string

// Turns a notification into the text shown in the toast: keys are translated,
// raw text (an API error message) is shown as is.
export function resolveNotificationText(
  notification: NotificationContent,
  translate: Translate,
): { title: string; description?: string } {
  const title = notification.titleKey
    ? translate(notification.titleKey, notification.titleValues)
    : notification.title
  const description = notification.descriptionKey
    ? translate(notification.descriptionKey, notification.descriptionValues)
    : notification.description
  return { title: title ?? "", description }
}
