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

/** A piece of the email text: plain, or in bold in the HTML version. */
type Segment = string | { strong: string }

/** "Alex Martin": each word of the name starts with a capital letter. An email is left as it is. */
function capitalizeName(name: string): string {
  if (name.includes("@")) return name
  return name.replace(
    /(^|[\s-])(\p{L})/gu,
    (_, separator, letter) => separator + letter.toUpperCase(),
  )
}

/** " as a member": the role a workspace invitation gives. */
function describeWorkspaceRole(language: Language, role: string): string {
  const isAdmin = role === "admin"
  if (language === "en") return isAdmin ? " as an admin" : " as a member"
  return isAdmin ? " en tant qu'administrateur" : " en tant que membre"
}

/**
 * "You will have access to these agents: A and B.", each name in bold. An admin gets every agent.
 * Nothing for a member without agents.
 */
function describeAgentAccess(
  language: Language,
  access: NonNullable<InvitationEmailParams["workspaceAccess"]>,
): Segment[] {
  if (access.role === "admin") {
    return [
      language === "en"
        ? "You will have access to every agent."
        : "Vous aurez accès à tous les agents.",
    ]
  }
  if (access.agentNames.length === 0) return []
  const names = new Intl.ListFormat(language, { type: "conjunction" })
    .formatToParts(access.agentNames)
    .map((part): Segment => (part.type === "element" ? { strong: part.value } : part.value))
  const intro =
    language === "en"
      ? "You will have access to these agents: "
      : "Vous aurez accès à ces agents : "
  return [intro, ...names, "."]
}

const LABELS: Record<Language, { subject: string; button: string; signIn: string }> = {
  en: { subject: "Invitation:", button: "Open the invitation", signIn: "Sign in with" },
  fr: { subject: "Invitation :", button: "Ouvrir l'invitation", signIn: "Connectez-vous avec" },
}

/**
 * The invitation email, in the inviter's language: the platform does not know the language of
 * someone who never signed in. Who invites to what, the agents it gives, one button and one line
 * about the address.
 */
export function buildInvitationEmail(params: InvitationEmailParams): MailMessage {
  // The agent and review campaign routes do not validate the body: an unknown language is English.
  const language =
    INVITATION_EMAIL_LANGUAGES.find((supported) => supported === params.language) ?? "en"
  const labels = LABELS[language]
  const target = `${TARGET_LABELS[language][params.targetType]} ${params.targetName}`
  const organization = params.organizationName ? ` (${params.organizationName})` : ""
  const role = params.workspaceAccess
    ? describeWorkspaceRole(language, params.workspaceAccess.role)
    : ""
  const invitation: Segment[] = [
    { strong: capitalizeName(params.inviterName) },
    language === "en"
      ? ` invited you to join ${target}${organization}${role}.`
      : ` vous invite à rejoindre ${target}${organization}${role}.`,
  ]
  const agents = params.workspaceAccess ? describeAgentAccess(language, params.workspaceAccess) : []
  const paragraphs = agents.length > 0 ? [invitation, agents] : [invitation]
  const reminder = `${labels.signIn} ${params.to}`

  const text = [...paragraphs.map(toText), params.link, reminder].join("\n\n")

  const html = [
    `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#111827">`,
    ...paragraphs.map((paragraph) => `<p>${toHtml(paragraph)}</p>`),
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

function toText(segments: Segment[]): string {
  return segments
    .map((segment) => (typeof segment === "string" ? segment : segment.strong))
    .join("")
}

function toHtml(segments: Segment[]): string {
  return segments
    .map((segment) =>
      typeof segment === "string"
        ? escapeHtml(segment)
        : `<strong>${escapeHtml(segment.strong)}</strong>`,
    )
    .join("")
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
