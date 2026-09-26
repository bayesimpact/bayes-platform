import type { AppGrantablePermission } from "@caseai-connect/api-contracts"
import {
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  LayoutGridIcon,
  PencilIcon,
  SettingsIcon,
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
  "project.read": LayoutGridIcon,
  "project.update": SettingsIcon,
  "project.delete": Trash2Icon,
}

export function AppInstallPermissionIcon({ permission }: { permission: AppGrantablePermission }) {
  const Icon = PERMISSION_ICONS[permission] ?? FileTextIcon
  return (
    <div className="flex size-[30px] shrink-0 items-center justify-center rounded-md bg-[#ede9fe]">
      <Icon className="size-4 stroke-[#7c3aed]" aria-hidden />
    </div>
  )
}

export function permissionCopyKey(permission: string): string {
  return permission.replaceAll(".", "_")
}
