import type { Locale } from "@/consts"

/**
 * UI chrome strings (navigation, labels, buttons) per locale.
 * Article *content* lives in `src/content/docs/{locale}/…`, not here.
 */
export const ui = {
  en: {
    "site.title": "Help Center",
    "site.tagline": "Guides and answers for the Bayes Platform.",
    "nav.home": "Home",
    "nav.backToApp": "Back to the app",
    "search.label": "Search",
    "search.placeholder": "Search the help center…",
    "search.noResults": "No results found.",
    "search.hint": "Type to search articles",
    "theme.toggle": "Toggle theme",
    "lang.label": "Language",
    "toc.title": "On this page",
    "article.updated": "Last updated",
    "article.readingTime": "min read",
    "article.prev": "Previous",
    "article.next": "Next",
    "article.related": "Related guides",
    "breadcrumb.home": "Home",
    "feedback.question": "Was this article helpful?",
    "feedback.yes": "Yes",
    "feedback.no": "No",
    "feedback.thanks": "Thanks for your feedback!",
    "home.heading": "How can we help?",
    // Keyword within `home.heading` to emphasise with the brand marker-highlight.
    "home.highlight": "help",
    "home.categories": "Browse by category",
    "footer.rights": "Bayes Impact. All rights reserved.",
    "footer.legalNotice": "Legal Notice",
    "footer.privacyPolicy": "Privacy Policy",
    "notFound.title": "Page not found",
    "notFound.body": "The page you are looking for does not exist or has moved.",
    "notFound.cta": "Go to the help center home",
  },
  fr: {
    "site.title": "Centre d'aide",
    "site.tagline": "Guides et réponses pour la plateforme Bayes.",
    "nav.home": "Accueil",
    "nav.backToApp": "Retour à l'application",
    "search.label": "Rechercher",
    "search.placeholder": "Rechercher dans le centre d'aide…",
    "search.noResults": "Aucun résultat.",
    "search.hint": "Tapez pour rechercher des articles",
    "theme.toggle": "Changer de thème",
    "lang.label": "Langue",
    "toc.title": "Sur cette page",
    "article.updated": "Dernière mise à jour",
    "article.readingTime": "min de lecture",
    "article.prev": "Précédent",
    "article.next": "Suivant",
    "article.related": "Guides liés",
    "breadcrumb.home": "Accueil",
    "feedback.question": "Cet article vous a-t-il aidé ?",
    "feedback.yes": "Oui",
    "feedback.no": "Non",
    "feedback.thanks": "Merci pour votre retour !",
    "home.heading": "Comment pouvons-nous vous aider ?",
    "home.highlight": "aider",
    "home.categories": "Parcourir par catégorie",
    "footer.rights": "Bayes Impact. Tous droits réservés.",
    "footer.legalNotice": "Mentions légales",
    "footer.privacyPolicy": "Politique de confidentialité",
    "notFound.title": "Page introuvable",
    "notFound.body": "La page que vous recherchez n'existe pas ou a été déplacée.",
    "notFound.cta": "Aller à l'accueil du centre d'aide",
  },
} as const satisfies Record<Locale, Record<string, string>>

export type UIKey = keyof (typeof ui)["en"]

/** Returns a translator bound to a locale, falling back to English. */
export function useTranslations(locale: Locale) {
  return function t(key: UIKey): string {
    return ui[locale][key] ?? ui.en[key]
  }
}

export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Français",
}
