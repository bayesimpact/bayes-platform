import { describe, expect, it } from "vitest"
import { INK, themeColors } from "./theme"

describe("themeColors", () => {
  it("keeps white text and the colour itself on a dark primary", () => {
    expect(themeColors("#000000")).toEqual({
      primary: "#000000",
      onPrimary: "#ffffff",
      onMark: "#ffffff",
      accent: "#000000",
      onAccent: "#ffffff",
    })
  })
  it("puts ink on a light primary and falls back to ink for the accent", () => {
    const c = themeColors("#F2EFE9")
    expect(c.onPrimary).toBe(INK)
    expect(c.accent).toBe(INK)
    expect(c.onAccent).toBe("#ffffff")
  })
  it("keeps a mid-tone brand colour as the accent", () => {
    const c = themeColors("#2563eb")
    expect(c.onPrimary).toBe("#ffffff")
    expect(c.accent).toBe("#2563eb")
  })
  it("keeps the launcher's dots white on the Bayes orange, ink on a pale colour", () => {
    const orange = themeColors("#f18c6e")
    expect(orange.onPrimary).toBe(INK)
    expect(orange.onMark).toBe("#ffffff")
    expect(themeColors("#F2EFE9").onMark).toBe(INK)
  })
  it("reads three-digit hex and rgb()", () => {
    expect(themeColors("#fff").onPrimary).toBe(INK)
    expect(themeColors("rgb(0, 0, 0)").onPrimary).toBe("#ffffff")
  })
  it("keeps white text on a colour it cannot read", () => {
    expect(themeColors("tomato").onPrimary).toBe("#ffffff")
  })
})
