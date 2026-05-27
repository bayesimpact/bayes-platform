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
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { selectAgentEmbedConfig } from "../agent-embed-configs.selectors"
import { agentEmbedConfigsActions } from "../agent-embed-configs.slice"

export function AgentEmbedTab({ agent }: { agent: Agent }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const configData = useAppSelector(selectAgentEmbedConfig)

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    dispatch(agentEmbedConfigsActions.mount())
    return () => {
      dispatch(agentEmbedConfigsActions.unmount())
    }
  }, [dispatch])

  const config = ADS.isFulfilled(configData) ? configData.value : null

  const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? false)
  const [allowedOriginsText, setAllowedOriginsText] = useState(
    config?.allowedOrigins.join(", ") ?? "",
  )
  const [title, setTitle] = useState(config?.title ?? "")
  const [logoUrl, setLogoUrl] = useState(config?.logoUrl ?? "")
  const [primaryColor, setPrimaryColor] = useState(config?.primaryColor ?? "")

  useEffect(() => {
    if (config) {
      setIsEnabled(config.isEnabled)
      setAllowedOriginsText(config.allowedOrigins.join(", "))
      setTitle(config.title ?? "")
      setLogoUrl(config.logoUrl ?? "")
      setPrimaryColor(config.primaryColor ?? "")
    }
  }, [config])

  const embedBaseUrl =
    (import.meta.env.VITE_EMBED_URL as string | undefined) ?? window.location.origin
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
    const allowedOrigins = allowedOriginsText
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
    dispatch(
      agentEmbedConfigsActions.updateConfig({
        isEnabled,
        allowedOrigins,
        title: title.trim() || null,
        logoUrl: logoUrl.trim() || null,
        primaryColor: primaryColor.trim() || null,
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
        <Switch id="embed-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
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
          value={allowedOriginsText}
          onChange={(e) => setAllowedOriginsText(e.target.value)}
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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={agent.name}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="embed-logo-url">{t("agent:embed.logoUrlLabel")}</FieldLabel>
        <FieldDescription>{t("agent:embed.logoUrlDescription")}</FieldDescription>
        <Input
          id="embed-logo-url"
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
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
            value={primaryColor || "#2563eb"}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded border border-input p-0.5"
          />
          <Input
            id="embed-primary-color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
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
