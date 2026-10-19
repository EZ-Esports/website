# Vercel Project Handover Guide

This guide details the process for transitioning the `ezesports` website (`ezesports.org`) from the current owner to a new owner without downtime and without requiring a Vercel Pro subscription.

---

## Zero-Downtime Strategy Overview

Vercel restricts direct project transfers between Hobby accounts and Teams unless the receiving team is subscribed to Vercel Pro. To complete this transfer completely free of cost with zero downtime:

1. **Pre-deploy & Verify First**: The new owner imports the project, loads the environment variables, and deploys a live working build to Vercel's default domain (`*.vercel.app`).
2. **Synchronized Domain Handshake**: Over a quick call or chat:
   - The outgoing owner releases `ezesports.org` from their Vercel instance.
   - The incoming owner immediately adds `ezesports.org` and `www.ezesports.org` to their newly deployed project.
   - Because the registrar's DNS records already point to Vercel Anycast IP (`76.76.21.21`) and CNAME (`cname.vercel-dns.com`), Vercel edge routers immediately route incoming traffic to the new project without waiting for DNS propagation.
3. **Decommission Old Instance**: The outgoing owner deletes their old Vercel project.

---

## For the New Owner: Autonomous Agent Instructions

Copy and paste the instructions below into your AI coding agent (e.g. Claude Code, Gemini CLI, Cursor, Windsurf) connected to your Vercel CLI.

```markdown
# Agent Task: Deploy EZ-Esports Website & Take Over Vercel Project

You are acting as an autonomous DevOps / full-stack agent. Your task is to set up, configure, and deploy the `EZ-Esports/website` Next.js project under the user's Vercel account, configure production environment variables from the local `.env` file, deploy, and attach the custom domains.

---

## Prerequisites (User must ensure before running)
1. User is authenticated with Vercel CLI (`npx vercel whoami` succeeds).
2. User has write access to `git@github.com:EZ-Esports/website.git`.
3. User has received the production secrets from the previous owner and saved them into `.env` (or `.env.local` / `.env.production`) in the project root.
   Required keys:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `NEXT_PUBLIC_APP_URL` (defaults to https://ezesports.org if omitted)

---

## Phase 1: Local Setup & Dependencies
Run in shell:
```bash
# Verify git branch
git checkout main
git pull origin main

# Install dependencies
npm install

# Verify tests pass locally
npm run test
```

---

## Phase 2: Create & Link Vercel Project
Create and link the project under your Vercel scope non-interactively:

```bash
# Create project under your account/team
npx vercel project add ezesports

# Link the local workspace to the project
npx vercel link --project ezesports --yes
```

---

## Phase 3: Push Environment Variables from Local `.env`
Read secrets directly from the local `.env` file in the repo and push them to Vercel for `production` and `preview`.

Execute the following helper to load and set the required variables:
```bash
# Set each variable into Vercel from the local .env file
for KEY in DATABASE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY NEXT_PUBLIC_APP_URL; do
  VAL=$(grep -E "^${KEY}=" .env | cut -d '=' -f2- | tr -d '"'\''')
  if [ -n "$VAL" ]; then
    echo -n "$VAL" | npx vercel env add "$KEY" production preview --force
    echo "✓ Added $KEY to Vercel"
  else
    echo "⚠ Warning: $KEY not found in .env"
  fi
done

# Ensure NEXT_PUBLIC_APP_URL is set
if ! grep -q "^NEXT_PUBLIC_APP_URL=" .env; then
  echo -n "https://ezesports.org" | npx vercel env add NEXT_PUBLIC_APP_URL production preview --force
fi

# List and verify variable presence
npx vercel env ls --project ezesports
```

---

## Phase 4: Initial Production Deployment (Zero-Downtime Verification)
Deploy the project to production before attaching the domain to verify builds and database connections:

```bash
npx vercel deploy --prod --yes
```

Inspect the returned URL (e.g. `https://ezesports-xxx.vercel.app`):
- Run `curl -I <DEPLOYMENT_URL>` to confirm HTTP 200 / 308 response.
- Verify Supabase data queries succeed.

---

## Phase 5: Domain Handshake (`ezesports.org`)
**PAUSE HERE** until the outgoing owner confirms they have released `ezesports.org` from their Vercel account.

Once confirmed released, immediately execute:
```bash
# Add apex domain and www subdomain
npx vercel domains add ezesports.org --project ezesports
npx vercel domains add www.ezesports.org --project ezesports
```

Verify domain status:
```bash
npx vercel domains inspect ezesports.org
```

DNS Checklist:
- **Apex (`@` or `ezesports.org`)**: A record pointing to `76.76.21.21`
- **Subdomain (`www`)**: CNAME record pointing to `cname.vercel-dns.com`

---

## Phase 6: Final Verification
```bash
# 1. Verify production domain responds
curl -I https://www.ezesports.org

# 2. Check apex redirects cleanly to www (or vice versa)
curl -I https://ezesports.org
```
Confirm:
- HTTP 200 response
- SSL certificate is active
- Report success to the user!
```

---

## For the Outgoing Owner: Execution Checklist

When on the call with the new developer:

### 1. Wait for New Owner to Complete Phase 4
Confirm that the new owner has run `npx vercel deploy --prod` and verified their preview URL.

### 2. Release the Domain (Instant Handshake)
In your terminal, release domain ownership:
```bash
npx vercel domains remove ezesports.org -y
```
Tell the new developer to immediately run **Phase 5** (`npx vercel domains add ezesports.org`).

### 3. Decommission Old Instance
Once `https://www.ezesports.org` is serving traffic from the new owner's project:
```bash
npx vercel project rm ezesports --yes
```
This cleanly removes `ezesports` from your account while leaving all other personal projects untouched.
