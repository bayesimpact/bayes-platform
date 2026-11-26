/// <reference types="vite/client" />

import type { Messages } from "@lingui/core"

/** A catalog of this folder, compiled by Lingui's Vite plugin on import. */
declare module "*.po" {
  export const messages: Messages
}
