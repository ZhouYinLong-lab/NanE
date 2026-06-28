# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project overview

NanE (南易) is a free campus mutual-aid platform for Nanjing University students. It matches surplus non-prescription medical supplies and consumables within the same dorm building/dorm group/campus. The platform enforces three hard boundaries: free sharing only (no sales), manual review of all posts, and medicines limited to common OTC categories.

The project has evolved from a WeChat Mini Program demo into a deployable Node.js backend + vanilla web frontend + admin console, sharing one PostgreSQL database. The Mini Program code is retained but not the primary deployment target right now.

## Commands

```bash
npm install                          # Install dependencies (pg, @fortawesome/fontawesome-free)
npm run dev:api                      # Start server on PORT (default 37878)
npm start                            # Same as dev:api
npm test                             # Start an isolated test API server, then run Node tests
npm run test:direct                  # Run tests against NANE_TEST_BASE_URL or http://localhost:37878
```

Requires Node.js >= 18 and a running PostgreSQL instance with a `nane` database. Copy `.env.example` to `.env` and fill in required values before starting.

Production deployment on Azure VM uses PM2:
```bash
cd ~/apps/NanE && git pull && pm2 restart nane-api --update-env
pm2 logs nane-api --lines 100
```

There is no frontend build step. The Node test suite covers utility modules plus API smoke/regression paths.

## Architecture

### Single-process backend (`server/index.js`)

The entire server is a single ~2000-line file using Node's built-in `http` module. It handles:

1. **Static file serving** — Serves `web/` for the browser client (paths `/`, `/web/*`), `admin/` for console assets, `uploads/` for local image uploads, and `miniprogram/assets/` (paths `/assets/*`). No separate frontend build.
2. **User-facing API** — All routes under `/api/*` (auth, items, me, claims).
3. **Admin API + HTML console** — `/admin` returns `admin/index.html`; `/admin/*` serves console assets; `/api/admin/*` handles admin actions.
4. **Database initialization** — `initializeDatabase()` in `server/db.js` runs `schema.sql` and applies ALTER TABLE migrations on every startup. Seed data is inserted on first run.

**Routing pattern:** `server/index.js` keeps static serving and iterates the router modules in `server/router/`. Add new API routes inside the matching router module, then include a new router in the `routers` array only when a new route family is introduced.

### Key server modules

- **`server/db.js`** — PostgreSQL connection pool (`pg`), `query()` helper, `makeId(prefix)`, `hashPassword()`, and `initializeDatabase()` which runs schema + migrations + seeds.
- **`server/env.js`** — Loads `.env` file into `process.env` before any other module reads it. Uses `require("./env")` as a side-effect import at the top of `index.js`.
- **`server/proximity.js`** — Dorm group assignment for Xianlin, Suzhou, and Pukou campuses. Provides `proximityForItem(row, viewer)` returning `{rank, scope, label}` and `sortByProximity(rows, viewer)`.
- **`server/schema.sql`** — Base DDL (users, items, contact_views, claim_requests, email_challenges, review_logs, admins). New columns are added via ALTER TABLE in `db.js` rather than modifying this file.

### Authentication

Two identity providers, both resulting in a NanE-signed JWT:

- **NJU Student Email** (`@smail.nju.edu.cn`): Backend generates a 6-digit code, hashes it, stores in `email_challenges`, sends via SMTP. User submits code to `/api/auth/email/verify`.
- **Nanna (南哪小帮手)**: Backend proxies challenge/verify to the Nanna API using `NANNA_API_KEY` (never exposed to frontend). On success, creates/updates user by `openid`.

JWT tokens are manually implemented (HS256 HMAC, no library) — see `signToken()` and `verifyToken()`.

### Permission model

- **Guest** — browse items, view public details (no contact info).
- **Verified user** (`is_verified=true`) — publish items, view contacts (max 5/day), manage own items.
- **Admin** — login via `/api/admin/login`, review/approve/reject/take-down items, view stats.

Every protected endpoint calls `requireVerifiedUser()` or `requireAdmin()` which sends a 401/403 JSON response and returns null, so the caller must `if (!viewer) return;`.

### Frontend (`web/`)

Vanilla HTML/CSS/JS single-page app with four tabs: 发现 (Home), 发布 (Publish), 我的 (My Items), 设置 (Settings). No framework, no build tooling. The JS (`web/app.js`, ~60KB) manages view switching, API calls, and UI state. CSS uses a warm beige background (`#f5f3ed`) with NJU purple (`#6E0065`) as accent.

### Data flow

1. Browser calls `/api/*` on the same origin (Nginx proxies both `/` and `/api` to the Node process).
2. Server reads JWT from `Authorization: Bearer <token>` header.
3. Business logic is inline in route handlers — there are no service layers or middleware abstractions.
4. Item sorting on the home feed uses `sortByProximity()` which ranks by same building > same dorm group > same campus > other campus, then by `created_at` descending.

### Database

PostgreSQL accessed via `pg` Pool. Key tables: `users`, `items`, `contact_views`, `claim_requests`, `email_challenges`, `review_logs`, `admins`. Item statuses: `reviewing`, `online`, `rejected`, `taken_down`, `expired`, `claimed`. The `owner_hidden` column on items acts as a soft-delete for the owner's "my items" view.

## Important conventions

- IDs use prefix + UUID snippet: `u_3f8a2b1c`, `item_7d3e...`. Always use `makeId(prefix)` from `db.js`.
- All API responses are JSON with `{ error, message }` on failure, and use `json(res, status, payload)` helper.
- Cross-origin is open (`Access-Control-Allow-Origin: *`) — the API is designed to serve the Mini Program from a different origin.
- Contact info (wechat/QQ) is never included in public item responses — only in the dedicated `/api/items/:id/contact` endpoint and owner/admin views.
- Expiry dates use `YYYY-MM-DD` format. Items can set `no_expiry=true` except for medicines (validated in update handler).
- New DB columns are added in `db.js` via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, not by editing `schema.sql`.
