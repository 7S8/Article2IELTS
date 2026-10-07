/* Database connection (Supabase). Fill these in to store accounts and progress online
   for all users; leave them empty to keep everything in this browser only.
   Where to find them: Supabase → your project → Project Settings → API.
   The "anon public" key is meant to be public — it is safe to put here because
   every table is protected by Row Level Security (see supabase/schema.sql). */
window.A2I_CONFIG = window.A2I_CONFIG || {
  supabaseUrl: '', // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '', // the long "anon public" key
};
