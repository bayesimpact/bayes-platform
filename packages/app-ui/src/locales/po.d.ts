/// <reference types="vite/client" />

/** A catalog of this folder, compiled by Lingui's Vite plugin on import. */
declare module "*.po" {
  export const messages: import("@lingui/core").Messages
}
