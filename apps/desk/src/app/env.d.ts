/// <reference types="vite/client" />

import type { Messages } from "@lingui/core"

declare global {
  interface ImportMetaEnv {
    readonly VITE_OIDC_AUTHORITY?: string
    readonly VITE_OIDC_CLIENT_ID?: string
    readonly VITE_OIDC_AUDIENCE?: string
    readonly VITE_OIDC_SCOPE?: string
    readonly VITE_OIDC_AUTHORIZATION_PARAMS?: string
  }

  interface Window {
    /** The configuration the API injects into index.html when it serves the Desk. */
    __CONFIG__?: Record<string, string | undefined>
  }
}

declare module "react" {
  /** A CSS custom property a style sets for its classes to read, such as `--sidebar-width`. */
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined
  }
}

/** A catalog of src/locales, compiled by Lingui's Vite plugin on import. */
declare module "*.po" {
  export const messages: Messages
}
