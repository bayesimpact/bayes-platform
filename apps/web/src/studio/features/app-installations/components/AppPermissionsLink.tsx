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
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AppPermissionIcon } from "@/common/features/oauth-consent/components/AppPermissionIcon"

/**
 * A link that opens the list of an app's permissions. `requested` lists what the app may
 * ask for at install (catalog), `granted` what an installation holds.
 */
export function AppPermissionsLink({
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
      {/* A button styled as a link: it opens a dialog, it goes to no page. */}
      <Button
        variant="link"
        size="sm"
        className="h-auto self-start p-0 font-normal underline"
        onClick={() => setIsOpen(true)}
      >
        {t("appInstallations:permissions.link", { count: permissions.length })}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("appInstallations:permissions.title", { name: appName })}</DialogTitle>
            <DialogDescription>
              {t(`appInstallations:permissions.description.${kind}`, { name: appName })}
            </DialogDescription>
          </DialogHeader>
          <ItemGroup className="gap-5">
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
          <DialogFooter>
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
