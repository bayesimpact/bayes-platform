import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { CheckIcon, CopyIcon } from "lucide-react"
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
import { useReportDirty } from "@/studio/features/agents/agent-settings/components/agent-tab-form.shared"
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

type CopyTarget = "snippet" | "publicPage"

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
  const { t } = useTranslation()
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

  const embedBaseUrl =
    (import.meta.env.VITE_AGENT_EMBED_URL as string | undefined) ?? window.location.origin
  const embedSnippet = config
    ? `<script src="${embedBaseUrl}/launcher.js" data-token="${config.embedToken}"></script>`
    : ""
  // Standalone hosted page: the same chat, served full-screen at a shareable URL (link or QR code).
  const publicPageUrl = config
    ? `${embedBaseUrl}/index.html?embedToken=${config.embedToken}&displayMode=drawer`
    : ""

  const handleCopy = async (target: CopyTarget) => {
    const text = target === "snippet" ? embedSnippet : publicPageUrl
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
    <FieldGroup>
      <Field orientation="horizontal">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="embed-enabled">{t("agentSettings:embed.enabledLabel")}</FieldLabel>
          <FieldDescription>
            {t("agentSettings:embed.enabledDescription", { name: agent.name })}
          </FieldDescription>
        </div>
        <Switch
          id="embed-enabled"
          checked={form.isEnabled}
          onCheckedChange={(isEnabled) => setForm((prev) => ({ ...prev, isEnabled }))}
        />
      </Field>

      {config && (
        <Field>
          <FieldLabel>{t("agentSettings:embed.snippetLabel")}</FieldLabel>
          <FieldDescription>{t("agentSettings:embed.snippetDescription")}</FieldDescription>
          <div className="flex gap-2 items-start">
            <Textarea
              readOnly
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
          <p className="text-xs text-muted-foreground mt-1">
            {t("agentSettings:embed.snippetHint")}
          </p>
        </Field>
      )}

      {config && (
        <Field>
          <FieldLabel htmlFor="embed-public-page-url">
            {t("agentSettings:embed.publicPageLabel")}
          </FieldLabel>
          <FieldDescription>
            {t("agentSettings:embed.publicPageDescription", { name: agent.name })}
          </FieldDescription>
          <div className="flex gap-2 items-start">
            <Input
              id="embed-public-page-url"
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
          <p className="text-xs text-muted-foreground mt-1">
            {t("agentSettings:embed.publicPageHint")}
          </p>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="allowed-origins">
          {t("agentSettings:embed.allowedOriginsLabel")}
        </FieldLabel>
        <FieldDescription>{t("agentSettings:embed.allowedOriginsDescription")}</FieldDescription>
        <Input
          id="allowed-origins"
          value={form.allowedOriginsText}
          onChange={(e) => setForm((prev) => ({ ...prev, allowedOriginsText: e.target.value }))}
          placeholder={t("agentSettings:embed.allowedOriginsPlaceholder")}
        />
      </Field>

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
        <FieldLabel htmlFor="embed-logo-url">{t("agentSettings:embed.logoUrlLabel")}</FieldLabel>
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

      <Field orientation="horizontal" className="justify-end">
        <Button type="button" className="w-fit" onClick={handleUpdate}>
          {t("actions:update")}
        </Button>
      </Field>
    </FieldGroup>
  )
}
