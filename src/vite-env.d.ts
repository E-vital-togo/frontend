/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de l'API (voir lib/config.ts) ; absente = repli sur la production. */
  readonly API_BASE_URL?: string;
  /** URL publique du frontend ; absente = origine de la page. */
  readonly FRONTEND_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.svg" {
  const chemin: string;
  export default chemin;
}
