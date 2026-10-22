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
    /** The browser's speech recognition, which Chrome and Safari still name with a prefix. */
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }

  /** The events of the browser's speech recognition, whose payloads lib.dom declares. */
  interface SpeechRecognitionEventMap {
    result: SpeechRecognitionEvent
    error: SpeechRecognitionErrorEvent
    start: Event
    end: Event
  }

  /**
   * The parts of the browser's speech recognition the Desk uses. lib.dom declares its events but
   * not the recognition itself, which only some browsers have.
   */
  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start(): void
    stop(): void
    addEventListener<K extends keyof SpeechRecognitionEventMap>(
      type: K,
      listener: (this: SpeechRecognition, event: SpeechRecognitionEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions,
    ): void
    removeEventListener<K extends keyof SpeechRecognitionEventMap>(
      type: K,
      listener: (this: SpeechRecognition, event: SpeechRecognitionEventMap[K]) => void,
      options?: boolean | EventListenerOptions,
    ): void
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
