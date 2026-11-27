/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the foxslash API base, e.g. `http://localhost/api/steamchecker`. */
  readonly VITE_FOXSLASH_API_URL?: string;
  /** Override the foxslash page config URL, e.g. for a local foxslash server. */
  readonly VITE_STEAMCHECKER_CONFIG_URL?: string;
  /** Override the foxslash sign-in page, e.g. `http://localhost:8003/extension/connect`. */
  readonly VITE_FOXSLASH_CONNECT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
