# HMBB Cost Calculator

Prices handmade products from a material catalogue, and keeps the material
inventory behind it. Used alongside Shopify.

## Running it

```bash
npm install
npm run dev
```

Then open **http://localhost:5180**.

That one command runs everything — UI, API and database are a single Node
process on a single port. No second terminal, no Docker, no cloud account, and
it works with the network off.

Your data lives in **`data/app.db`**, a plain SQLite file. Backing up is
copying that file (or **Settings → Data → Back up now** for a JSON bundle).

## Everyday use

| Screen | What it does |
|---|---|
| **Dashboard** | What needs attention, and the shape of the catalogue |
| **Calculator** | Price a product from materials, labour, fees and tax |
| **Inventory** | The 194-material catalogue: costs, suppliers, `*` common items |
| **Products** | Saved products; load one back into the calculator, export for Shopify |
| **Settings** | Labour rate, tax, fees, default profit, appearance, backups |

The draft in the calculator survives a refresh, so closing the tab mid-price
does not lose work.

### Conventions carried over from the old app

- A **`*`** anywhere in a material name marks it "common" — **Add Common (\*)**
  drops every one of them into the draft at once.
- Profit is **markup on cost**, not gross margin: 20% on a $100 cost gives
  $120, which is a 16.7% margin. Settings shows this with real numbers.
- Products keep the tax and fees they were priced with. Changing Settings never
  reprices anything already saved.

## Sharing it temporarily

The app binds `0.0.0.0`, so it can be exposed through a tunnel:

```bash
npm run share
```

That sets `TUNNEL_MODE`, which **requires the password** (loopback auto-trust
switches off) and fixes the cookie flags for HTTPS. Set a password first:

```bash
npm run setup:password
```

Preferred order: **Tailscale Funnel** → **Cloudflare Tunnel + Access** →
**ngrok with basic auth** → a Cloudflare quick tunnel (fully public — password
on, brief use only).

## Architecture

Vite + React 19 + TypeScript, Tailwind v4, Express 5, SQLite via
better-sqlite3 and Drizzle. One origin serves the UI and `/api`.

> The previous README described React + Grommet talking to a Python middleware
> in front of Supabase. That Supabase project has since been **deleted**, which
> is why the old app could not load data. Everything now runs locally.

The cost math in `shared/costMath.ts` is a verified 1:1 port of the original
JavaScript, checked against a golden-master corpus built from 17 real products
(`npm run test:math`). Treat it as frozen — changing it reprices the catalogue.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run the app (port 5180) |
| `npm run share` | Run it for tunnel access, password required |
| `npm test` | Test suite |
| `npm run test:math` | Prove the cost math still matches the original |
| `npm run db:verify` | Check the database against the source exports |
| `npm run db:seed` | Restore the catalogue from `data/seed/` |
| `npm run check` | TypeScript |
| `npm run lint:tokens` | Fail on any hardcoded colour |
| `npm run dev:legacy` | The original Grommet UI, for comparison |

## Data recovery note

`data/seed/` holds the exports the catalogue was rebuilt from after the
Supabase project was deleted — 194 materials and 17 products. They are
committed deliberately and checksummed in `SHA256SUMS.txt`, because for a while
they were the only surviving copy. Do not delete them.
