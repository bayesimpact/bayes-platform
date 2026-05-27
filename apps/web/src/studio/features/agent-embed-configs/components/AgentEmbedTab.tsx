"use client"

import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { useMount } from "@/common/hooks/use-mount"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { AgentEmbedConfig } from "../agent-embed-configs.models"
import { selectAgentEmbedConfig } from "../agent-embed-configs.selectors"
import { agentEmbedConfigsActions } from "../agent-embed-configs.slice"

type EmbedFormState = {
  isEnabled: boolean
  allowedOriginsText: string
  title: string
  logoUrl: string
  primaryColor: string
}

function toFormState(config: AgentEmbedConfig): EmbedFormState {
  return {
    isEnabled: config.isEnabled,
    allowedOriginsText: config.allowedOrigins.join(", "),
    title: config.title ?? "",
    logoUrl: config.logoUrl ?? "",
    primaryColor: config.primaryColor ?? "",
  }
}

const emptyFormState: EmbedFormState = {
  isEnabled: false,
  allowedOriginsText: "",
  title: "",
  logoUrl: "",
  primaryColor: "",
}

export function AgentEmbedTab({ agent }: { agent: Agent }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const configData = useAppSelector(selectAgentEmbedConfig)

  useMount({ actions: agentEmbedConfigsActions })

  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState<EmbedFormState>(emptyFormState)

  const config = ADS.isFulfilled(configData) ? configData.value : null

  useEffect(() => {
    if (config) setForm(toFormState(config))
  }, [config])

  const embedBaseUrl =
    (import.meta.env.VITE_AGENT_EMBED_URL as string | undefined) ?? window.location.origin
  const embedSnippet = config
    ? `<script src="${embedBaseUrl}/launcher.js" data-token="${config.embedToken}"></script>`
    : ""

  const handleCopy = async () => {
    if (!embedSnippet) return
    await navigator.clipboard.writeText(embedSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      }),
    )
  }

  if (ADS.isLoading(configData) || ADS.isUninitialized(configData)) {
    return (
      <FieldGroup>
        <p className="text-sm text-muted-foreground">{t("agent:embed.loading")}</p>
      </FieldGroup>
    )
  }

  if (ADS.isError(configData)) {
    return (
      <FieldGroup>
        <p className="text-sm text-destructive">{t("agent:embed.loadError")}</p>
      </FieldGroup>
    )
  }

  return (
    <FieldGroup>
      <Field orientation="horizontal">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="embed-enabled">{t("agent:embed.enabledLabel")}</FieldLabel>
          <FieldDescription>
            {t("agent:embed.enabledDescription", { name: agent.name })}
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
          <FieldLabel>{t("agent:embed.snippetLabel")}</FieldLabel>
          <FieldDescription>{t("agent:embed.snippetDescription")}</FieldDescription>
          <div className="flex gap-2 items-start">
            <Textarea
              readOnly
              value={embedSnippet}
              rows={2}
              className="font-mono text-xs resize-none"
            />
            <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{t("agent:embed.snippetHint")}</p>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="allowed-origins">{t("agent:embed.allowedOriginsLabel")}</FieldLabel>
        <FieldDescription>{t("agent:embed.allowedOriginsDescription")}</FieldDescription>
        <Input
          id="allowed-origins"
          value={form.allowedOriginsText}
          onChange={(e) => setForm((prev) => ({ ...prev, allowedOriginsText: e.target.value }))}
          placeholder={t("agent:embed.allowedOriginsPlaceholder")}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="embed-title">{t("agent:embed.titleLabel")}</FieldLabel>
        <FieldDescription>
          {t("agent:embed.titleDescription", { name: agent.name })}
        </FieldDescription>
        <Input
          id="embed-title"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder={agent.name}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="embed-logo-url">{t("agent:embed.logoUrlLabel")}</FieldLabel>
        <FieldDescription>{t("agent:embed.logoUrlDescription")}</FieldDescription>
        <Input
          id="embed-logo-url"
          type="url"
          value={form.logoUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
          placeholder={t("agent:embed.logoUrlPlaceholder")}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="embed-primary-color">{t("agent:embed.primaryColorLabel")}</FieldLabel>
        <FieldDescription>{t("agent:embed.primaryColorDescription")}</FieldDescription>
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

      <Field orientation="horizontal" className="justify-end">
        <Button type="button" className="w-fit" onClick={handleUpdate}>
          {t("actions:update")}
        </Button>
      </Field>
    </FieldGroup>
  )
}
