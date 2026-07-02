/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_I18N_REGION?: "kr" | "jp";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
