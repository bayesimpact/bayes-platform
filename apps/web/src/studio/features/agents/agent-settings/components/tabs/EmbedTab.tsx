import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { runtimeConfig } from "@/config/runtime-config"
import { useReportDirty } from "@/studio/features/agents/agent-settings/components/agent-tab-form.shared"
import { AgentTabSectionHeader } from "@/studio/features/agents/agent-settings/components/tabs/AgentTabSectionHeader"
import {
  toHelpPageUrl,
  toPublicApiOrigin,
} from "@/studio/features/agents/agent-settings/components/tabs/embed-tab.helpers"
import type { AgentEmbedConfig } from "../../../../agent-embed-configs/agent-embed-configs.models"
import { selectAgentEmbedConfig } from "../../../../agent-embed-configs/agent-embed-configs.selectors"
import { agentEmbedConfigsActions } from "../../../../agent-embed-configs/agent-embed-configs.slice"

type EmbedFormState = {
  isEnabled: boolean
  allowedOriginsText: string
  title: string
  logoUrl: string
  primaryColor: string
  bannerText: string
}

function toFormState(config: AgentEmbedConfig): EmbedFormState {
  return {
    isEnabled: config.isEnabled,
    allowedOriginsText: config.allowedOrigins.join(", "),
    title: config.title ?? "",
    logoUrl: config.logoUrl ?? "",
    primaryColor: config.primaryColor ?? "",
    bannerText: config.bannerText ?? "",
  }
}

const emptyFormState: EmbedFormState = {
  isEnabled: false,
  allowedOriginsText: "",
  title: "",
  logoUrl: "",
  primaryColor: "",
  bannerText: "",
}

type CopyTarget = "snippet" | "publicPage" | "apiBaseUrl"

export function EmbedTab({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const agentId = useCurrentId(selectCurrentAgentId)
  const config = useAppSelector(selectAgentEmbedConfig)

  useMount({ actions: agentEmbedConfigsActions, refreshOn: [agentId] })

  return (
    <AsyncRoute data={[config]}>
      <WithData onDirtyChange={onDirtyChange} />
    </AsyncRoute>
  )
}

function WithData({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { t, i18n } = useTranslation()
  const dispatch = useAppDispatch()
  const agent = useValue(selectCurrentAgentData)
  const config = useValue(selectAgentEmbedConfig)

  const [copied, setCopied] = useState<CopyTarget | null>(null)
  const [form, setForm] = useState<EmbedFormState>(emptyFormState)

  useEffect(() => {
    if (config) setForm(toFormState(config))
  }, [config])

  const isDirty = config ? JSON.stringify(form) !== JSON.stringify(toFormState(config)) : false
  useReportDirty(isDirty, onDirtyChange)

  const embedBaseUrl = runtimeConfig.agentEmbedUrl ?? window.location.origin
  const embedSnippet = config
    ? `<script src="${embedBaseUrl}/launcher.js" data-token="${config.embedToken}"></script>`
    : ""
  // Standalone hosted page: the same chat, served full-screen at a shareable URL (link or QR code).
  const publicPageUrl = config
    ? `${embedBaseUrl}/index.html?embedToken=${config.embedToken}&displayMode=drawer`
    : ""
  const apiBaseUrl = config
    ? `${toPublicApiOrigin(runtimeConfig.apiUrl)}/public/v1/agents/${config.embedToken}`
    : ""
  // The help center documents the widget and the API; without one, the links are hidden.
  const widgetGuideUrl = toHelpPageUrl(runtimeConfig.helpCenterUrl, i18n.language, "agent-embed")
  const apiReferenceUrl = toHelpPageUrl(
    runtimeConfig.helpCenterUrl,
    i18n.language,
    "public-chat-api",
  )

  const copyTexts: Record<CopyTarget, string> = {
    snippet: embedSnippet,
    publicPage: publicPageUrl,
    apiBaseUrl,
  }

  const handleCopy = async (target: CopyTarget) => {
    const text = copyTexts[target]
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(target)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleUpdate = () => {
    const allowedOrigins = form.allowedOriginsText
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
    dispatch(
      agentEmbedConfigsActions.updateConfig({
        isEnabled: form.isEnabled,
        allowedOrigins,
        title: form.title.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
        primaryColor: form.primaryColor.trim() || null,
        bannerText: form.bannerText.trim() || null,
      }),
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <section className="min-w-0 rounded-lg border p-4">
        <AgentTabSectionHeader
          title={t("agentSettings:embed.enabledLabel")}
          description={t("agentSettings:embed.enabledDescription", { name: agent.name })}
          action={
            <Switch
              id="embed-enabled"
              aria-label={t("agentSettings:embed.enabledLabel")}
              checked={form.isEnabled}
              onCheckedChange={(isEnabled) => setForm((prev) => ({ ...prev, isEnabled }))}
            />
          }
        />
      </section>

      <section className="min-w-0 space-y-4 rounded-lg border p-4">
        <AgentTabSectionHeader
          title={t("agentSettings:embed.appearance.title")}
          description={t("agentSettings:embed.appearance.description")}
        />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="embed-title">{t("agentSettings:embed.titleLabel")}</FieldLabel>
            <FieldDescription>
              {t("agentSettings:embed.titleDescription", { name: agent.name })}
            </FieldDescription>
            <Input
              id="embed-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={agent.name}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="embed-logo-url">
              {t("agentSettings:embed.logoUrlLabel")}
            </FieldLabel>
            <FieldDescription>{t("agentSettings:embed.logoUrlDescription")}</FieldDescription>
            <Input
              id="embed-logo-url"
              type="url"
              value={form.logoUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
              placeholder={t("agentSettings:embed.logoUrlPlaceholder")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="embed-primary-color">
              {t("agentSettings:embed.primaryColorLabel")}
            </FieldLabel>
            <FieldDescription>{t("agentSettings:embed.primaryColorDescription")}</FieldDescription>
            <div className="flex items-center gap-2">
              <input
                id="embed-primary-color-picker"
                type="color"
                value={form.primaryColor || "#2563eb"}
                onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                className="h-9 w-10 cursor-pointer rounded border border-input p-0.5"
              />
              <Input
                id="embed-primary-color"
                value={form.primaryColor}
                onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                placeholder="#2563eb"
                className="font-mono"
              />
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="embed-banner-text">
              {t("agentSettings:embed.bannerTextLabel")}
            </FieldLabel>
            <FieldDescription>{t("agentSettings:embed.bannerTextDescription")}</FieldDescription>
            <Textarea
              id="embed-banner-text"
              value={form.bannerText}
              onChange={(e) => setForm((prev) => ({ ...prev, bannerText: e.target.value }))}
              placeholder={t("agentSettings:embed.bannerTextPlaceholder")}
              rows={2}
              maxLength={300}
            />
          </Field>
        </FieldGroup>
      </section>

      {config && (
        <section className="min-w-0 space-y-4 rounded-lg border p-4">
          <AgentTabSectionHeader
            title={t("agentSettings:embed.snippetLabel")}
            description={t("agentSettings:embed.snippetDescription")}
          />
          <div className="flex gap-2 items-start">
            <Textarea
              readOnly
              aria-label={t("agentSettings:embed.snippetLabel")}
              value={embedSnippet}
              rows={2}
              className="font-mono text-xs resize-none"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCopy("snippet")}
            >
              {copied === "snippet" ? (
                <CheckIcon className="size-4" />
              ) : (
                <CopyIcon className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("agentSettings:embed.snippetHint")}</p>
          <Field>
            <FieldLabel htmlFor="allowed-origins">
              {t("agentSettings:embed.allowedOriginsLabel")}
            </FieldLabel>
            <FieldDescription>
              {t("agentSettings:embed.allowedOriginsDescription", { embedOrigin: embedBaseUrl })}
            </FieldDescription>
            <Input
              id="allowed-origins"
              value={form.allowedOriginsText}
              onChange={(e) => setForm((prev) => ({ ...prev, allowedOriginsText: e.target.value }))}
              placeholder={t("agentSettings:embed.allowedOriginsPlaceholder")}
            />
          </Field>
          {widgetGuideUrl && (
            <HelpLink href={widgetGuideUrl} label={t("agentSettings:embed.widgetGuideLink")} />
          )}
        </section>
      )}

      {config && (
        <section className="min-w-0 space-y-4 rounded-lg border p-4">
          <AgentTabSectionHeader
            title={t("agentSettings:embed.publicPageLabel")}
            description={t("agentSettings:embed.publicPageDescription", { name: agent.name })}
          />
          <div className="flex gap-2 items-start">
            <Input
              id="embed-public-page-url"
              aria-label={t("agentSettings:embed.publicPageLabel")}
              readOnly
              value={publicPageUrl}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCopy("publicPage")}
            >
              {copied === "publicPage" ? (
                <CheckIcon className="size-4" />
              ) : (
                <CopyIcon className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("agentSettings:embed.publicPageHint")}</p>
        </section>
      )}

      <section className="min-w-0 space-y-4 rounded-lg border p-4">
        <AgentTabSectionHeader
          title={t("agentSettings:embed.apiSection.title")}
          description={t("agentSettings:embed.apiSection.description")}
        />
        {config && (
          <Field>
            <FieldLabel htmlFor="embed-api-base-url">
              {t("agentSettings:embed.apiBaseUrlLabel")}
            </FieldLabel>
            <FieldDescription>{t("agentSettings:embed.apiBaseUrlDescription")}</FieldDescription>
            <div className="flex gap-2 items-start">
              <Input
                id="embed-api-base-url"
                readOnly
                value={apiBaseUrl}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopy("apiBaseUrl")}
              >
                {copied === "apiBaseUrl" ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
              </Button>
            </div>
          </Field>
        )}
        {apiReferenceUrl && (
          <HelpLink href={apiReferenceUrl} label={t("agentSettings:embed.apiReferenceLink")} />
        )}
      </section>

      <div className="flex justify-end">
        <Button type="button" className="w-fit" onClick={handleUpdate}>
          {t("actions:update")}
        </Button>
      </div>
    </div>
  )
}

function HelpLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
    >
      {label}
      <ExternalLinkIcon className="size-3.5" />
    </a>
  )
}
