# EZ Esports Website

The official EZ Esports website, hosted at ezesports.org

## How to Run

### Prerequisites

Make sure you have Node.js installed on your system.

### Installation

Install dependencies:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the website.

### Environment and database

Copy the env vars described in [docs/dev/SUPABASE.md](docs/dev/SUPABASE.md) into `.env`. **`DATABASE_URL` in this repo's `.env` is the production database**; read [CLAUDE.md](CLAUDE.md) before running any `db:*` script, and use a local Postgres with an explicit `DATABASE_URL` for experiments.

### Tests and checks

```bash
npm test          # vitest
npm run lint
npx tsc --noEmit
```

`.githooks/pre-push` runs the same checks (`npm install` points git at it via the `prepare` script).

### Project docs

[docs/QUICKSTART.md](docs/QUICKSTART.md) for a code map and first-deploy bootstrap, and [spec/README.md](spec/README.md) for the project's living history and architecture notes.

### Production Build

Build the production version:

```bash
npm run build
```

Start the production server:

```bash
npm start
```
