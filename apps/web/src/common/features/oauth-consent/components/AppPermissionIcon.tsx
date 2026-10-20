import type { AppGrantablePermission } from "@caseai-connect/api-contracts"
import {
  BotIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  LayoutGridIcon,
  MessagesSquareIcon,
  PencilIcon,
  SettingsIcon,
  TagIcon,
  TagsIcon,
  Trash2Icon,
} from "lucide-react"

const PERMISSION_ICONS: Record<AppGrantablePermission, typeof FileTextIcon> = {
  "document.read": FileTextIcon,
  "document.create": FilePlusIcon,
  "document.update": PencilIcon,
  "document.delete": Trash2Icon,
  "document_source.read": FolderIcon,
  "document_source.create": FolderPlusIcon,
  "document_source.update": PencilIcon,
  "document_source.delete": Trash2Icon,
  "document_tag.read": TagIcon,
  "document_tag.create": TagsIcon,
  "document_tag.update": PencilIcon,
  "document_tag.delete": Trash2Icon,
  "project.read": LayoutGridIcon,
  "project.update": SettingsIcon,
  "project.delete": Trash2Icon,
  "agent.read": BotIcon,
  "agent.conversation.session.external.create": MessagesSquareIcon,
}

export function AppPermissionIcon({ permission }: { permission: string }) {
  const Icon = isAppGrantablePermission(permission) ? PERMISSION_ICONS[permission] : FileTextIcon
  return (
    <div className="flex size-[30px] shrink-0 items-center justify-center rounded-md bg-accent">
      <Icon className="size-4 text-accent-foreground" aria-hidden />
    </div>
  )
}

function isAppGrantablePermission(permission: string): permission is AppGrantablePermission {
  return Object.hasOwn(PERMISSION_ICONS, permission)
}
