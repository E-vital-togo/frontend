/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.svg" {
  const chemin: string;
  export default chemin;
}
