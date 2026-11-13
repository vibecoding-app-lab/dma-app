// Supabase project for Drive Master Academy. The anon key is designed to ship
// inside the app; row-level security in the database protects the data.
// A .env file with EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY overrides these.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zvaxeullvxzcboebzico.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YXhldWxsdnh6Y2JvZWJ6aWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MzA0NDMsImV4cCI6MjEwNzQwNjQ0M30.5P8dUmMExpk88yOIkeUNNvFqMFtVn4u5QfTRZt4EtvI';
