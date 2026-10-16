import i18next from "i18next"
import { beforeAll, describe, expect, it } from "vitest"
import { resolveNotificationText } from "./notifications.helpers"

const i18n = i18next.createInstance()

beforeAll(async () => {
  await i18n.init({
    lng: "fr",
    resources: {
      fr: {
        sample: {
          notifications: {
            saved: "Enregistré",
            uploaded: "{{fileName}} téléversé avec succès",
            deleted_one: "{{count}} élément supprimé",
            deleted_other: "{{count}} éléments supprimés",
            details: "Détails pour {{name}}",
          },
        },
      },
    },
  })
})

const translate = (key: string, values?: Record<string, string | number>) => i18n.t(key, values)

describe("resolveNotificationText", () => {
  it("translates a title key", () => {
    expect(
      resolveNotificationText(
        { titleKey: "sample:notifications.saved", type: "success" },
        translate,
      ),
    ).toEqual({ title: "Enregistré", description: undefined })
  })

  it("interpolates title values", () => {
    expect(
      resolveNotificationText(
        {
          titleKey: "sample:notifications.uploaded",
          titleValues: { fileName: "report.pdf" },
          type: "success",
        },
        translate,
      ).title,
    ).toBe("report.pdf téléversé avec succès")
  })

  it("picks the plural form from count", () => {
    const resolve = (count: number) =>
      resolveNotificationText(
        { titleKey: "sample:notifications.deleted", titleValues: { count }, type: "success" },
        translate,
      ).title
    expect(resolve(1)).toBe("1 élément supprimé")
    expect(resolve(3)).toBe("3 éléments supprimés")
  })

  it("keeps raw title and description as they are", () => {
    expect(
      resolveNotificationText(
        { title: "Request failed with status 500", description: "Server error", type: "error" },
        translate,
      ),
    ).toEqual({ title: "Request failed with status 500", description: "Server error" })
  })

  it("translates a description key next to a translated title", () => {
    expect(
      resolveNotificationText(
        {
          titleKey: "sample:notifications.saved",
          descriptionKey: "sample:notifications.details",
          descriptionValues: { name: "Alpha" },
          type: "info",
        },
        translate,
      ),
    ).toEqual({ title: "Enregistré", description: "Détails pour Alpha" })
  })
})
