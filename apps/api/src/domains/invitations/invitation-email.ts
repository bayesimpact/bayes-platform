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

/** "You join as a member, with A and B." An admin gets every agent, so no list. */
function describeWorkspaceAccess(
  language: Language,
  access: NonNullable<InvitationEmailParams["workspaceAccess"]>,
): string {
  const isAdmin = access.role === "admin"
  const agents = new Intl.ListFormat(language, { type: "conjunction" }).format(access.agentNames)
  if (language === "en") {
    if (isAdmin) return "You join as an admin, with every agent."
    return access.agentNames.length === 0
      ? "You join as a member."
      : `You join as a member, with ${agents}.`
  }
  if (isAdmin) return "Vous rejoignez en tant qu'administrateur, avec tous les agents."
  return access.agentNames.length === 0
    ? "Vous rejoignez en tant que membre."
    : `Vous rejoignez en tant que membre, avec ${agents}.`
}

/**
 * The invitation email, in English then French: the platform does not know the
 * language of someone who never signed in. One button below both, since both
 * open the same link.
 */
export function buildInvitationEmail(params: InvitationEmailParams): MailMessage {
  const paragraphs = (language: Language) => {
    const target = `${TARGET_LABELS[language][params.targetType]} ${params.targetName}`
    const organization = params.organizationName ? ` (${params.organizationName})` : ""
    const access = params.workspaceAccess
      ? describeWorkspaceAccess(language, params.workspaceAccess)
      : null
    return language === "en"
      ? {
          intro: `${params.inviterName} invited you to join ${target}${organization}.`,
          access,
          action: "Open the invitation below, then sign in, or sign up, and accept it.",
          reminder: `Use exactly this email address: ${params.to}. With another address, you will not see the invitation.`,
        }
      : {
          intro: `${params.inviterName} vous invite à rejoindre ${target}${organization}.`,
          access,
          action:
            "Ouvrez l'invitation ci-dessous, puis connectez-vous, ou inscrivez-vous, et acceptez-la.",
          reminder: `Utilisez exactement cette adresse email : ${params.to}. Avec une autre adresse, vous ne verrez pas l'invitation.`,
        }
  }
  const sections = [paragraphs("en"), paragraphs("fr")]
  const button = "Open the invitation · Ouvrir l'invitation"

  const text = [
    ...sections.map((section) =>
      [section.intro, section.access, section.action, section.reminder]
        .filter(Boolean)
        .join("\n\n"),
    ),
    params.link,
  ].join("\n\n---\n\n")

  const htmlSection = (section: ReturnType<typeof paragraphs>) =>
    [
      `<p>${escapeHtml(section.intro)}</p>`,
      section.access ? `<p>${escapeHtml(section.access)}</p>` : "",
      `<p>${escapeHtml(section.action)}</p>`,
      `<p style="color:#6b7280">${escapeHtml(section.reminder)}</p>`,
    ]
      .filter(Boolean)
      .join("\n")

  const html = [
    `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#111827">`,
    sections
      .map(htmlSection)
      .join(`\n<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">\n`),
    `<p style="margin-top:24px"><a href="${escapeHtml(params.link)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#111827;color:#ffffff;text-decoration:none">${escapeHtml(button)}</a></p>`,
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
