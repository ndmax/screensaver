/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Unsplash API access key (https://unsplash.com/oauth/applications) */
  readonly VITE_UNSPLASH_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
