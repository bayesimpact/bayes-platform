import { buildAppInstallCallbackUrl, buildAppInstallDeniedUrl } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { ArrowRightIcon, GlobeIcon, ShieldCheckIcon } from "lucide-react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { selectAppInstallPage } from "@/common/features/app-install/app-install.selectors"
import { authorizeAppInstall } from "@/common/features/app-install/app-install.thunks"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { AppInstallPermissionIcon, permissionCopyKey } from "./AppInstallPermissionIcon"
import { BayesCrossMark } from "./BayesCrossMark"

type SubmitPhase = "idle" | "authorizing" | "authorized"

export function AppsInstallCard({
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
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle")
  const [projectId, setProjectId] = useState(page.projects[0]?.id ?? "")
  const canInstall = page.projects.length > 0
  const cancelUrl = buildAppInstallDeniedUrl({ redirectUri, state })

  const onAuthorize = async () => {
    if (!canInstall || submitPhase !== "idle") return
    setSubmitPhase("authorizing")
    try {
      const result = await dispatch(
        authorizeAppInstall({
          slug,
          projectId,
          permissions: page.app.grantablePermissions,
          redirectUri,
          state,
        }),
      ).unwrap()
      setSubmitPhase("authorized")
      window.location.assign(
        buildAppInstallCallbackUrl({
          redirectUri: result.redirectUri,
          clientId: result.clientId,
          clientSecret: result.clientSecret,
          state: result.state,
        }),
      )
    } catch {
      setSubmitPhase("idle")
    }
  }

  const submitLabel =
    submitPhase === "authorizing"
      ? t("authorizing")
      : submitPhase === "authorized"
        ? t("authorized")
        : t("submit", { name: page.app.name })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f4f6] p-6 font-[Inter,system-ui,sans-serif] text-[#111118]">
      <div className="w-full max-w-[440px] rounded-[12px] border border-[#e4e4e7] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <AppMark logoUrl={page.app.logoUrl} />
          <ArrowRightIcon className="size-4 shrink-0 text-[#a1a1aa]" aria-hidden />
          <BayesCrossMark />
        </div>
        <h1 className="text-lg font-semibold leading-snug">
          {t("headline", { name: page.app.name })}
        </h1>

        {canInstall ? (
          <label className="mt-6 flex flex-col gap-1.5">
            <span className="text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase">
              {t("workspace")}
            </span>
            <select
              className="h-10 w-full rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm text-[#111118]"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              disabled={submitPhase !== "idle"}
            >
              {page.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.organizationName} / {project.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-6 text-sm text-[#71717a]">{t("noWorkspaces")}</p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <span className="text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase">
            {t("permissionsRequested")}
          </span>
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

        <Button
          type="button"
          className="mt-6 h-11 w-full rounded-lg bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-100"
          disabled={!canInstall || submitPhase === "authorized"}
          onClick={onAuthorize}
        >
          {submitPhase === "idle" ? <ShieldCheckIcon className="size-4" aria-hidden /> : null}
          {submitLabel}
        </Button>
        <a
          href={cancelUrl}
          className="mt-3 block text-center text-sm text-[#71717a] underline-offset-2 hover:underline"
        >
          {t("cancel")}
        </a>
      </div>
      <p className="mt-4 max-w-[440px] rounded-[12px] border border-[#e4e4e7] bg-white px-4 py-3 text-sm text-[#71717a]">
        <Trans
          i18nKey="revocability"
          ns="appInstall"
          values={{ name: page.app.name }}
          components={{ settings: <strong className="font-semibold text-[#111118]" /> }}
        />
      </p>
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
