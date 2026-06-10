import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import { loadLocales } from "./locales/loader"
import { colonHandlerPostProcessor } from "./locales/post-processors"

i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // register custom post-processor
  .use(colonHandlerPostProcessor)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    debug: import.meta.env.DEV,
    load: "languageOnly",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    postProcess: ["colonHandler"],
    resources: await loadLocales(),
  })

// Keep the document language in sync with the detected locale so browsers
// don't see an "English" page full of French content and offer to translate.
i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language
})
document.documentElement.lang = i18n.language

export default i18n
