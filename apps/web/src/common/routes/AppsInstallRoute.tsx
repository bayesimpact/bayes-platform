import {
  type AppGrantablePermission,
  appGrantablePermissionActionLabel,
  buildAppInstallCallbackUrl,
  groupAppGrantablePermissions,
  isLoopbackRedirectUri,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useParams, useSearchParams } from "react-router-dom"
import { z } from "zod"
import { selectAppInstallPage } from "@/common/features/app-install/app-install.selectors"
import { appInstallActions } from "@/common/features/app-install/app-install.slice"
import {
  authorizeAppInstall,
  fetchInstallPage,
} from "@/common/features/app-install/app-install.thunks"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "./AsyncRoute"
import { ErrorRoute } from "./ErrorRoute"

const installFormSchema = z.object({
  projectId: z.string().uuid(),
  permissions: z.array(z.string()),
})

type InstallFormValues = z.infer<typeof installFormSchema>

export function AppsInstallRoute() {
  const { t } = useTranslation("appInstall")
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const dispatch = useAppDispatch()
  const page = useAppSelector(selectAppInstallPage)
  const redirectUri = searchParams.get("redirect_uri") ?? ""
  const state = searchParams.get("state") ?? ""
  const hasValidLoopback = isLoopbackRedirectUri(redirectUri) && state.length > 0

  useEffect(() => {
    if (!slug || !hasValidLoopback) return
    dispatch(fetchInstallPage(slug))
    return () => {
      dispatch(appInstallActions.reset())
    }
  }, [dispatch, slug, hasValidLoopback])

  if (!slug) return <ErrorRoute error={t("missingSlug")} />
  if (!hasValidLoopback) return <ErrorRoute error={t("invalidRedirect")} />

  return (
    <AsyncRoute data={[page]}>
      <AppsInstallForm slug={slug} redirectUri={redirectUri} state={state} />
    </AsyncRoute>
  )
}

function AppsInstallForm({
  slug,
  redirectUri,
  state,
}: {
  slug: string
  redirectUri: string
  state: string
}) {
  const { t } = useTranslation("appInstall")
  const dispatch = useAppDispatch()
  const page = useValue(selectAppInstallPage)
  const permissionGroups = groupAppGrantablePermissions(page.app.grantablePermissions)

  const form = useForm<InstallFormValues>({
    resolver: zodResolver(installFormSchema),
    defaultValues: {
      projectId: page.projects[0]?.id ?? "",
      permissions: [...page.app.grantablePermissions],
    },
  })

  const onValid = async (values: InstallFormValues) => {
    const result = await dispatch(
      authorizeAppInstall({
        slug,
        projectId: values.projectId,
        permissions: values.permissions as AppGrantablePermission[],
        redirectUri,
        state,
      }),
    ).unwrap()
    window.location.assign(
      buildAppInstallCallbackUrl({
        redirectUri: result.redirectUri,
        clientId: result.clientId,
        clientSecret: result.clientSecret,
        state: result.state,
      }),
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-xl border bg-background p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {page.app.logoUrl ? (
            <img
              src={page.app.logoUrl}
              alt=""
              className="size-12 shrink-0 rounded-md border bg-muted object-contain"
            />
          ) : null}
          <div className="flex min-w-0 flex-col">
            <h1 className="text-xl font-semibold">{t("title", { name: page.app.name })}</h1>
            {page.app.description ? (
              <p className="text-sm text-muted-foreground">{page.app.description}</p>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        {page.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noWorkspaces")}</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onValid)} className="flex flex-col gap-5">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("workspace")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("workspacePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {page.projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.organizationName} / {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("permissions")}</FormLabel>
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(permissionGroups.length, 1)}, minmax(8rem, 1fr))`,
                      }}
                    >
                      {permissionGroups.map((group) => (
                        <fieldset key={group.resourceType} className="flex flex-col gap-2">
                          <legend className="text-sm font-medium">{group.label}</legend>
                          {group.permissions.map((permission) => {
                            const checkboxId = `install-${permission}`
                            return (
                              <div key={permission} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  id={checkboxId}
                                  checked={field.value.includes(permission)}
                                  onCheckedChange={(checked) => {
                                    field.onChange(
                                      checked === true
                                        ? [...field.value, permission]
                                        : field.value.filter(
                                            (selectedPermission) =>
                                              selectedPermission !== permission,
                                          ),
                                    )
                                  }}
                                />
                                <label htmlFor={checkboxId} className="cursor-pointer">
                                  {appGrantablePermissionActionLabel(permission)}
                                </label>
                              </div>
                            )
                          })}
                        </fieldset>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t("submit")}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  )
}
