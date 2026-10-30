// Supabase → Project Settings → API. Both values are safe to publish:
// the publishable key only gets what row-level security allows.
window.TG_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
  // Photo and video storage in Cloudflare R2 (worker/README.md). Leave it out to use Supabase storage instead.
  filesUrl: '',
}
