import {
  INVITATION_EMAIL_LANGUAGES,
  type InvitationEmailLanguageDto,
} from "@caseai-connect/api-contracts"
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
  /**
   * What a workspace invitation gives: its role (`admin` or `member`) and the names of its agents.
   * Left out for other invitations.
   */
  workspaceAccess?: { role: string; agentNames: string[] }
  /** The inviter's language. English when left out. */
  language?: InvitationEmailLanguageDto
}

type Language = InvitationEmailLanguageDto

const TARGET_LABELS: Record<Language, Record<InvitationTargetType, string>> = {
  en: { project: "the workspace", agent: "the agent", review_campaign: "the review campaign" },
  fr: {
    project: "l'espace de travail",
    agent: "l'agent",
    review_campaign: "la campagne d'évaluation",
  },
}

/** " as a member, with A and B": what a workspace invitation gives. An admin gets every agent. */
function describeWorkspaceAccess(
  language: Language,
  access: NonNullable<InvitationEmailParams["workspaceAccess"]>,
): string {
  const isAdmin = access.role === "admin"
  const agents = new Intl.ListFormat(language, { type: "conjunction" }).format(access.agentNames)
  if (language === "en") {
    if (isAdmin) return " as an admin, with every agent"
    return access.agentNames.length === 0 ? " as a member" : ` as a member, with ${agents}`
  }
  if (isAdmin) return " en tant qu'administrateur, avec tous les agents"
  return access.agentNames.length === 0
    ? " en tant que membre"
    : ` en tant que membre, avec ${agents}`
}

const LABELS: Record<Language, { subject: string; button: string; signIn: string }> = {
  en: { subject: "Invitation:", button: "Open the invitation", signIn: "Sign in with" },
  fr: { subject: "Invitation :", button: "Ouvrir l'invitation", signIn: "Connectez-vous avec" },
}

/**
 * The invitation email, in the inviter's language: the platform does not know the language of
 * someone who never signed in. One sentence, one button and one line about the address.
 */
export function buildInvitationEmail(params: InvitationEmailParams): MailMessage {
  // The agent and review campaign routes do not validate the body: an unknown language is English.
  const language =
    INVITATION_EMAIL_LANGUAGES.find((supported) => supported === params.language) ?? "en"
  const labels = LABELS[language]
  const target = `${TARGET_LABELS[language][params.targetType]} ${params.targetName}`
  const organization = params.organizationName ? ` (${params.organizationName})` : ""
  const access = params.workspaceAccess
    ? describeWorkspaceAccess(language, params.workspaceAccess)
    : ""
  const sentence =
    language === "en"
      ? `${params.inviterName} invited you to join ${target}${organization}${access}.`
      : `${params.inviterName} vous invite à rejoindre ${target}${organization}${access}.`
  const reminder = `${labels.signIn} ${params.to}`

  const text = [sentence, params.link, reminder].join("\n\n")

  const html = [
    `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#111827">`,
    `<p>${escapeHtml(sentence)}</p>`,
    `<p style="margin-top:24px"><a href="${escapeHtml(params.link)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#111827;color:#ffffff;text-decoration:none">${escapeHtml(labels.button)}</a></p>`,
    `<p style="color:#6b7280;font-size:13px">${escapeHtml(reminder)}</p>`,
    `</div>`,
  ].join("\n")

  return {
    to: params.to,
    subject: `${labels.subject} ${params.targetName}`,
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
