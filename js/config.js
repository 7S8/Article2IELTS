/* Database connection (Supabase). Fill these in to store accounts and progress online
   for all users; leave them empty to keep everything in this browser only.
   Where to find them: Supabase → your project → Project Settings → API Keys.
   Use the "Publishable key" (sb_publishable_…) or, on the "Legacy" tab, the "anon public" key.
   It is meant to be public — it is safe to put here because every table is protected by
   Row Level Security (see supabase/schema.sql). Never put a secret / service_role key here. */
window.A2I_CONFIG = window.A2I_CONFIG || {
  supabaseUrl: 'https://nhqxaiydhdhoacndbjnh.supabase.co',
  supabaseAnonKey: 'sb_publishable_Kn9mcSql-OWxQSLGfbyJxQ_r1eK4sQD',
};
