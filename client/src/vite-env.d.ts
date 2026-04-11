/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_ALLOWED_EMAIL_DOMAIN?: string;
  readonly VITE_DEV_EMAIL_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
