# Supabase Setup

## Environment Variables

Create a `.env` file in the project root with:

| Variable | Description | Where to use |
|----------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Both clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/public key (safe for client) | Client only |
| `SUPABASE_SECRET_KEY` | Service role key (server only) | Server only |

**→ Ping core team members for env secrets.** `.env` is gitignored and not committed.

## Supabase Clients

### `app/lib/supabase.js` — Client-side

Use in React components, client components, and browser code. Uses the publishable (anon) key with Row Level Security (RLS) applied.

```js
import { supabase } from '@/app/lib/supabase'

// In a client component or browser context
const { data } = await supabase.from('table').select()
```

### `app/lib/supabaseServer.js` — Server-side

Use in Server Components, Route Handlers, API routes, and server actions. Uses the service role key and bypasses RLS — use only for trusted server logic.

```js
import { supabaseServer } from '@/app/lib/supabaseServer'

// In a Server Component or API route
const { data } = await supabaseServer.from('table').select()
```

## When to use which

| Context | Client |
|---------|--------|
| `'use client'` components | `supabase` |
| Server Components | `supabaseServer` |
| Route Handlers / API routes | `supabaseServer` |
| Server Actions | `supabaseServer` |

### READ
`docs/dev/SUPABASE.md` for information on the database schema and TODOs.