import {
  authorizeAppInstallSchema,
  buildAppInstallCallbackUrl,
  buildAppInstallDeniedUrl,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
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
import { ArrowRightIcon, GlobeIcon, ShieldCheckIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import type { z } from "zod"
import { BackofficeProjectRoutes } from "@/backoffice/routes/helpers"
import {
  selectAppInstallCallbackState,
  selectAppInstallPage,
  selectAppInstallRedirectUri,
  selectAppInstallSlug,
} from "@/common/features/app-install/app-install.selectors"
import { authorizeAppInstall } from "@/common/features/app-install/app-install.thunks"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { AppInstallPermissionIcon, permissionCopyKey } from "./AppInstallPermissionIcon"
import { BayesCrossMark } from "./BayesCrossMark"

type FormValues = z.infer<typeof authorizeAppInstallSchema>

export function AppsInstallCard() {
  const { t } = useTranslation("appInstall")
  const dispatch = useAppDispatch()
  const page = useValue(selectAppInstallPage)
  const slug = useCurrentId(selectAppInstallSlug)
  const redirectUri = useAppSelector(selectAppInstallRedirectUri)
  const callbackState = useAppSelector(selectAppInstallCallbackState)
  const canInstall = page.projects.length > 0
  const cancelUrl = buildAppInstallDeniedUrl({ redirectUri, state: callbackState })

  const form = useForm<FormValues>({
    resolver: zodResolver(authorizeAppInstallSchema),
    defaultValues: {
      projectId: page.projects[0]?.id ?? "",
      permissions: page.app.grantablePermissions,
      redirectUri,
      state: callbackState,
    },
  })
  const selectedProjectId = form.watch("projectId")
  const revokePath = selectedProjectId
    ? BackofficeProjectRoutes.project.build({ projectId: selectedProjectId })
    : BackofficeProjectRoutes.projects.path

  const onValid = async (values: FormValues) => {
    const result = await dispatch(
      authorizeAppInstall({
        slug,
        projectId: values.projectId,
        permissions: values.permissions,
        redirectUri: values.redirectUri,
        state: values.state,
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
    <div className="flex h-dvh flex-col items-center justify-center overflow-hidden bg-[#f4f4f6] p-6 font-[Inter,system-ui,sans-serif] text-[#111118]">
      <div className="flex max-h-full min-h-0 w-full max-w-[440px] flex-col">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-[#e4e4e7] bg-white p-6 shadow-sm">
          <div className="mb-5 flex shrink-0 items-center gap-3">
            <AppMark logoUrl={page.app.logoUrl} />
            <ArrowRightIcon className="size-4 shrink-0 text-[#a1a1aa]" aria-hidden />
            <BayesCrossMark />
          </div>
          <h1 className="shrink-0 text-lg font-semibold leading-snug">
            {t("headline", { name: page.app.name })}
          </h1>

          {canInstall ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onValid)} className="mt-6 flex min-h-0 flex-col">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem className="shrink-0 gap-1.5">
                      <FormLabel className="text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase">
                        {t("workspace")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full rounded-lg border-[#e4e4e7] text-[#111118] shadow-none">
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

                <PermissionList />

                <Button
                  type="submit"
                  className="mt-6 h-11 w-full shrink-0 rounded-lg bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d28d9]"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? null : (
                    <ShieldCheckIcon className="size-4" aria-hidden />
                  )}
                  {form.formState.isSubmitting
                    ? t("authorizing")
                    : t("submit", { name: page.app.name })}
                </Button>
              </form>
            </Form>
          ) : (
            <>
              <p className="mt-6 shrink-0 text-sm text-[#71717a]">{t("noWorkspaces")}</p>
              <PermissionList />
            </>
          )}

          <a
            href={cancelUrl}
            className="mt-3 block shrink-0 text-center text-sm text-[#71717a] underline-offset-2 hover:underline"
          >
            {t("cancel")}
          </a>
        </div>
        <p className="mt-4 max-w-[440px] shrink-0 rounded-[12px] border border-[#e4e4e7] bg-white px-4 py-3 text-sm text-[#71717a]">
          <Trans
            i18nKey="revocability"
            ns="appInstall"
            values={{ name: page.app.name }}
            components={{
              settings: (
                <Link
                  to={revokePath}
                  className="font-semibold text-[#111118] underline-offset-2 hover:underline"
                />
              ),
            }}
          />
        </p>
      </div>
    </div>
  )
}

function PermissionList() {
  const { t } = useTranslation("appInstall")
  const page = useValue(selectAppInstallPage)

  return (
    <div className="mt-6 flex min-h-0 flex-col gap-3">
      <span className="shrink-0 text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase">
        {t("permissionsRequested")}
      </span>
      <div className="max-h-60 min-h-0 overflow-y-auto overscroll-contain pe-1 [scrollbar-gutter:stable]">
        <ul className="flex flex-col gap-3">
          {page.app.grantablePermissions.map((permission) => {
            const copyKey = permissionCopyKey(permission)
            return (
              <li key={permission} className="flex items-start gap-3">
                <AppInstallPermissionIcon permission={permission} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {t(`copy.${copyKey}.name`, { defaultValue: permission })}
                  </p>
                  <p className="text-sm text-[#71717a]">
                    {t(`copy.${copyKey}.description`, { defaultValue: "" })}
                  </p>
                </div>
                <code className="shrink-0 rounded-full bg-[#f4f4f6] px-2 py-0.5 font-mono text-[11px] text-[#71717a]">
                  {permission}
                </code>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function AppMark({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="size-[52px] shrink-0 rounded-[12px] border border-[#e4e4e7] bg-white object-contain"
      />
    )
  }
  return (
    <div className="flex size-[52px] shrink-0 items-center justify-center rounded-[12px] border border-[#e4e4e7] bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:6px_6px]">
      <GlobeIcon className="size-6 text-[#71717a]" aria-hidden />
    </div>
  )
}
