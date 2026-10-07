export type NotificationType = "success" | "error" | "info" | "warning"

export type NotificationValues = Record<string, string | number>

// A title is either a translation key (resolved by NotificationCenter) or raw text,
// such as an error message returned by the API. Never both.
type NotificationTitle =
  | { titleKey: string; titleValues?: NotificationValues; title?: never }
  | { title: string; titleKey?: never; titleValues?: never }

type NotificationDescription =
  | { descriptionKey: string; descriptionValues?: NotificationValues; description?: never }
  | { description?: string; descriptionKey?: never; descriptionValues?: never }

export type NotificationContent = NotificationTitle &
  NotificationDescription & {
    type: NotificationType
  }

export type Notification = NotificationContent & { id: string }
