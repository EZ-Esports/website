# Antigravity Rules for EZ Esports

## Development Server
- When starting or running the local development server (`npm run dev`, `next dev`), always run with outbound network access (`BypassSandbox: true`). The app connects to the remote Supabase Postgres database (`aws-1-us-east-1.pooler.supabase.com`), which requires outbound network access to resolve hostnames and fetch data.
