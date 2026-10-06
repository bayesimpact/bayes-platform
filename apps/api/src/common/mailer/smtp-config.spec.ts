import { getSmtpConfig } from "./smtp-config"

describe("getSmtpConfig", () => {
  it("is off without SMTP_HOST", () => {
    expect(getSmtpConfig({})).toBeNull()
    expect(getSmtpConfig({ SMTP_HOST: " " })).toBeNull()
  })

  it("defaults to port 587 with STARTTLS and no authentication", () => {
    expect(
      getSmtpConfig({ SMTP_HOST: "smtp.example.org", SMTP_FROM: "no-reply@example.org" }),
    ).toEqual({
      host: "smtp.example.org",
      port: 587,
      secure: false,
      from: "no-reply@example.org",
    })
  })

  it("uses TLS from the start on port 465 unless told otherwise", () => {
    const base = { SMTP_HOST: "smtp.example.org", SMTP_FROM: "no-reply@example.org" }
    expect(getSmtpConfig({ ...base, SMTP_PORT: "465" })?.secure).toBe(true)
    expect(getSmtpConfig({ ...base, SMTP_PORT: "465", SMTP_SECURE: "false" })?.secure).toBe(false)
  })

  it("reads the credentials", () => {
    expect(
      getSmtpConfig({
        SMTP_HOST: "smtp.example.org",
        SMTP_FROM: "no-reply@example.org",
        SMTP_USER: "apikey",
        SMTP_PASSWORD: "secret",
      })?.auth,
    ).toEqual({ user: "apikey", pass: "secret" })
  })

  it("refuses a half-done configuration", () => {
    expect(() => getSmtpConfig({ SMTP_HOST: "smtp.example.org" })).toThrow("SMTP_FROM")
    expect(() =>
      getSmtpConfig({ SMTP_HOST: "smtp.example.org", SMTP_FROM: "a@b.c", SMTP_PORT: "abc" }),
    ).toThrow("SMTP_PORT")
    expect(() =>
      getSmtpConfig({ SMTP_HOST: "smtp.example.org", SMTP_FROM: "a@b.c", SMTP_PASSWORD: "x" }),
    ).toThrow("SMTP_USER")
  })
})
