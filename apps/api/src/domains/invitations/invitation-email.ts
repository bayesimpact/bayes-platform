import type { MailMessage } from "@/common/mailer/mailer.service"
import type { InvitationTargetType } from "./invitation.types"

/**
 * Link to the web app with the OIDC `login_hint`: the app forwards it to the
 * identity provider, which pre-fills the email on its sign-in and sign-up
 * screens. The link carries no token and grants nothing by itself. Same format
 * as the "Copy invitation link" button of the web app.
 */
export function buildInvitationLink(appUrl: string, email: string): string {
  return `${appUrl}/?login_hint=${encodeURIComponent(email)}`
}

export type InvitationEmailParams = {
  to: string
  link: string
  inviterName: string
  targetType: InvitationTargetType
  targetName: string
  organizationName: string
}

type Language = "en" | "fr"

const TARGET_LABELS: Record<Language, Record<InvitationTargetType, string>> = {
  en: { project: "the workspace", agent: "the agent", review_campaign: "the review campaign" },
  fr: {
    project: "l'espace de travail",
    agent: "l'agent",
    review_campaign: "la campagne d'évaluation",
  },
}

/**
 * The invitation email, in English then French: the platform does not know the
 * language of someone who never signed in.
 */
export function buildInvitationEmail(params: InvitationEmailParams): MailMessage {
  const paragraphs = (language: Language) => {
    const target = `${TARGET_LABELS[language][params.targetType]} ${params.targetName}`
    const organization = params.organizationName ? ` (${params.organizationName})` : ""
    return language === "en"
      ? {
          intro: `${params.inviterName} invited you to join ${target}${organization}.`,
          action: "Open the link below, then sign in, or sign up, and accept the invitation:",
          button: "Open the invitation",
          reminder: `Use exactly this email address: ${params.to}. With another address, you will not see the invitation.`,
        }
      : {
          intro: `${params.inviterName} vous invite à rejoindre ${target}${organization}.`,
          action:
            "Ouvrez le lien ci-dessous, puis connectez-vous, ou inscrivez-vous, et acceptez l'invitation :",
          button: "Ouvrir l'invitation",
          reminder: `Utilisez exactement cette adresse email : ${params.to}. Avec une autre adresse, vous ne verrez pas l'invitation.`,
        }
  }
  const english = paragraphs("en")
  const french = paragraphs("fr")

  const text = [english, french]
    .map((language) =>
      [language.intro, language.action, params.link, language.reminder].join("\n\n"),
    )
    .join("\n\n---\n\n")

  const htmlSection = (language: ReturnType<typeof paragraphs>) =>
    [
      `<p>${escapeHtml(language.intro)}</p>`,
      `<p>${escapeHtml(language.action)}</p>`,
      `<p><a href="${escapeHtml(params.link)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#111827;color:#ffffff;text-decoration:none">${escapeHtml(language.button)}</a></p>`,
      `<p style="color:#6b7280">${escapeHtml(language.reminder)}</p>`,
    ].join("\n")

  const html = [
    `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#111827">`,
    htmlSection(english),
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">`,
    htmlSection(french),
    `</div>`,
  ].join("\n")

  return {
    to: params.to,
    subject: `Invitation: ${params.targetName} · Invitation : ${params.targetName}`,
    text,
    html,
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
