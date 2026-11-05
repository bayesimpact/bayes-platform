import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@caseai-connect/ui/shad/item"
import { ShieldCheckIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AppPermissionIcon } from "@/common/features/oauth-consent/components/AppPermissionIcon"

/**
 * A small button that opens the list of an app's permissions. `requested` lists what the app may
 * ask for at install (catalog), `granted` what an installation holds.
 */
export function AppPermissionsButton({
  appName,
  permissions,
  kind,
}: {
  appName: string
  permissions: readonly string[]
  kind: "requested" | "granted"
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" className="self-start" onClick={() => setIsOpen(true)}>
        <ShieldCheckIcon />
        {t("appInstallations:permissions.button", { count: permissions.length })}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {/* Only the list scrolls: the title and the close button stay in view. */}
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0">
          <DialogHeader className="border-b p-6 pr-12">
            <DialogTitle>{t("appInstallations:permissions.title", { name: appName })}</DialogTitle>
            <DialogDescription>
              {t(`appInstallations:permissions.description.${kind}`, { name: appName })}
            </DialogDescription>
          </DialogHeader>
          <ItemGroup className="min-h-0 flex-1 gap-5 overflow-y-auto p-6">
            {groupByResource(permissions).map((group) => (
              <div key={group.resource} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t(`oauthConsent:appResource.${group.resource}`, {
                    defaultValue: group.resource,
                  })}
                </h3>
                {group.permissions.map((permission) => {
                  const copyKey = permission.replaceAll(".", "_")
                  return (
                    <Item key={permission} size="sm" className="items-start gap-3 p-0">
                      <ItemMedia variant="icon">
                        <AppPermissionIcon permission={permission} />
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle>
                          {t(`oauthConsent:appPermission.${copyKey}.name`, {
                            defaultValue: permission,
                          })}
                        </ItemTitle>
                        <ItemDescription>
                          {t(`oauthConsent:appPermission.${copyKey}.description`, {
                            defaultValue: "",
                          })}
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  )
                })}
              </div>
            ))}
          </ItemGroup>
          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              {t("actions:close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Groups permissions by their resource (the part before the first dot), in their order. */
function groupByResource(permissions: readonly string[]) {
  const groups = new Map<string, { resource: string; permissions: string[] }>()
  for (const permission of permissions) {
    const resource = permission.split(".")[0] ?? permission
    const group = groups.get(resource) ?? { resource, permissions: [] }
    group.permissions.push(permission)
    groups.set(resource, group)
  }
  return [...groups.values()]
}
