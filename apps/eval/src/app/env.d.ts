/// <reference types="vite/client" />

import type { Messages } from "@lingui/core"

declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: it augments a declaration, which only an interface can.
  interface ImportMetaEnv {
    readonly VITE_OIDC_AUTHORITY?: string
    readonly VITE_OIDC_CLIENT_ID?: string
    readonly VITE_OIDC_AUDIENCE?: string
    readonly VITE_OIDC_SCOPE?: string
    readonly VITE_OIDC_AUTHORIZATION_PARAMS?: string
    readonly VITE_HELP_CENTER_URL?: string
    readonly VITE_APP_VERSION?: string
    readonly VITE_GIT_SHA?: string
    readonly VITE_MCP_APP_SANDBOX_ORIGIN?: string
    /** The id of a production build, which `version.json` publishes too (vite.config.ts). */
    readonly VITE_BUILD_ID?: string
  }

  // biome-ignore lint/style/useConsistentTypeDefinitions: it augments a declaration, which only an interface can.
  interface Window {
    /** The configuration the API injects into index.html when it serves the app. */
    __CONFIG__?: Record<string, string | undefined>
  }
}

declare module "react" {
  /** A CSS custom property a style sets for its classes to read, such as `--sidebar-width`. */
  // biome-ignore lint/style/useConsistentTypeDefinitions: it augments a declaration, which only an interface can.
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined
  }
}

/** A catalog of src/locales, compiled by Lingui's Vite plugin on import. */
declare module "*.po" {
  export const messages: Messages
}
