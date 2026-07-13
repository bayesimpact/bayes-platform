import type { Locale } from "@/consts"

/**
 * Category metadata for grouping articles in the sidebar and on the home page.
 * `id` matches the `category` field in each article's frontmatter.
 * Icons are Lucide icon names rendered inline as SVG paths (see `Icon.astro`).
 *
 * Categories form a two-level tree: a top-level category has no `parent`, a
 * sub-category points at its parent via `parent`. Articles are always filed under
 * a leaf category (a sub-category when the parent has children). The sidebar and
 * home page only render categories that ultimately contain a doc, so a parent with
 * no filled children — or a reserved, still-empty sub-category — never shows.
 */
export type CategoryId =
  | "getting-started"
  | "guides"
  | "guides-agents"
  | "guides-sources"
  | "guides-team"
  | "guides-eval"
  | "account"
  | "faq"

export type Category = {
  id: CategoryId
  order: number
  icon: string
  label: Record<Locale, string>
  description: Record<Locale, string>
  /** Parent category id, for sub-categories. Omitted on top-level categories. */
  parent?: CategoryId
}

export const categories: Category[] = [
  {
    id: "getting-started",
    order: 1,
    icon: "rocket",
    label: { en: "Getting started", fr: "Premiers pas" },
    description: {
      en: "Set up your workspace and take your first steps.",
      fr: "Configurez votre espace et faites vos premiers pas.",
    },
  },
  // Guides is a parent category; its sub-categories below mirror the Studio
  // sidebar groups. `order` on a sub-category sorts it within Guides.
  {
    id: "guides",
    order: 2,
    icon: "book-open",
    label: { en: "Guides", fr: "Guides" },
    description: {
      en: "Step-by-step walkthroughs for everyday tasks.",
      fr: "Tutoriels étape par étape pour les tâches courantes.",
    },
  },
  {
    id: "guides-agents",
    parent: "guides",
    order: 1,
    icon: "bot-message-square",
    label: { en: "Agents", fr: "Agents" },
    description: {
      en: "Create and configure the agents that answer your users.",
      fr: "Créez et configurez les agents qui répondent à vos utilisateurs.",
    },
  },
  {
    id: "guides-sources",
    parent: "guides",
    order: 2,
    icon: "database-zap",
    label: { en: "Sources & knowledge", fr: "Sources & connaissances" },
    description: {
      en: "Add documents, web pages and libraries to your agents' knowledge.",
      fr: "Ajoutez documents, pages web et bibliothèques aux connaissances de vos agents.",
    },
  },
  {
    id: "guides-team",
    parent: "guides",
    order: 3,
    icon: "users",
    label: { en: "Team & access", fr: "Équipe & accès" },
    description: {
      en: "Invite people to your workspace and manage who has access.",
      fr: "Invitez des personnes dans votre espace de travail et gérez les accès.",
    },
  },
  {
    id: "guides-eval",
    parent: "guides",
    order: 4,
    icon: "list-checks",
    label: { en: "Evaluation & insights", fr: "Évaluation & analyses" },
    description: {
      en: "Test your agents and review conversations and analytics.",
      fr: "Testez vos agents et analysez les conversations et les statistiques.",
    },
  },
  {
    id: "account",
    order: 3,
    icon: "user",
    label: { en: "Account & settings", fr: "Compte et paramètres" },
    description: {
      en: "Manage your profile, members, and preferences.",
      fr: "Gérez votre profil, vos membres et vos préférences.",
    },
  },
  {
    id: "faq",
    order: 4,
    icon: "help-circle",
    label: { en: "FAQ", fr: "FAQ" },
    description: {
      en: "Answers to the questions we hear most often.",
      fr: "Réponses aux questions les plus fréquentes.",
    },
  },
]

export function getCategory(id: string): Category | undefined {
  return categories.find((category) => category.id === id)
}

export function categoryLabel(id: string, locale: Locale): string {
  return getCategory(id)?.label[locale] ?? id
}

/** Parent category id for a given category, or undefined if it is top-level. */
export function categoryParent(id: string): string | undefined {
  return getCategory(id)?.parent
}
