# Ecommerce Platform

A custom, single-vendor multi-product ecommerce platform — a **storefront**, an **admin panel**, and a shared **backend API**, built as a TypeScript monorepo.

> **Build status:** Phase 0 (Project Setup) ✅ · Phase 1 (Auth & User Management) ✅ · Phase 2 (Product Catalog) ⏳ next
> Full plan in `phase.md`, running status log in `memory.md`.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Storefront     │     │   Admin Panel    │
│   Next.js :3000  │     │   Next.js :3001  │
└────────┬─────────┘     └────────┬─────────┘
         │      REST + JWT (httpOnly refresh)     │
         └───────────────┬───────────────┘
                         ▼
              ┌────────────────────┐
              │  Backend API        │
              │  NestJS :4000/api   │
              └─────────┬──────────┘
                        ▼
              ┌────────────────────┐
              │  PostgreSQL (Prisma)│
              └────────────────────┘
```

Both frontends are independent Next.js apps consuming the same NestJS API. See `arc.md` for the full architecture.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 3 |
| Client state / validation | Zustand, Zod |
| Backend | NestJS 10, TypeScript (strict) |
| Database / ORM | PostgreSQL 16, Prisma 6 |
| Auth | JWT access + refresh (Passport), bcryptjs, httpOnly refresh cookie |
| Tooling | npm workspaces, Docker (dev Postgres), Jest |

---

## Repository Structure

```
ecommerce/
├── apps/
│   ├── api/            # NestJS backend (shared by both frontends)
│   ├── storefront/     # Customer-facing Next.js app (:3000)
│   └── admin/          # Admin panel Next.js app (:3001)
├── packages/
│   ├── shared-types/   # Shared TS interfaces / DTO contracts
│   └── ui/             # Shared UI primitives (placeholder, optional)
├── docker-compose.yml  # Dev PostgreSQL
└── *.md                # prd / arc / rule / phase / design / memory (project docs)
```

---

## Prerequisites

- **Node.js** ≥ 20 (developed on 24)
- **npm** ≥ 10
- **Docker** (for the local PostgreSQL container) — or your own PostgreSQL 16 instance

---

## Getting Started

### 1. Install dependencies (from repo root)

```bash
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` (db/user/pass all `ecommerce`).
Using your own Postgres instead? Update `DATABASE_URL` in `apps/api/.env`.

### 3. Configure environment

Copy the example env files and adjust as needed:

```bash
cp apps/api/.env.example         apps/api/.env
cp apps/storefront/.env.example  apps/storefront/.env.local
cp apps/admin/.env.example       apps/admin/.env.local
```

> `apps/api/.env` already exists with working dev defaults. **Never commit real secrets** — `.env` files are gitignored.

### 4. Set up the database schema

```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
```

### 5. Run the apps

From the repo root (each in its own terminal):

```bash
npm run dev:api          # http://localhost:4000/api
npm run dev:storefront   # http://localhost:3000
npm run dev:admin        # http://localhost:3001
```

---

## Creating an admin user

`POST /auth/register` always creates a **CUSTOMER**. To sign in to the admin panel you need a `STAFF` or `SUPER_ADMIN` user. Create one directly (a proper seed/CLI arrives in a later phase):

```bash
cd apps/api
node -e "const{PrismaClient}=require('@prisma/client');const b=require('bcryptjs');const p=new PrismaClient();p.user.create({data:{email:'admin@example.com',passwordHash:b.hashSync('password123',12),role:'SUPER_ADMIN',firstName:'Owner'}}).then(u=>{console.log('created',u.email);return p.\$disconnect();})"
```

Or use Prisma Studio: `npx prisma studio`.

---

## API (implemented so far)

Base URL: `http://localhost:4000/api`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check (DB connectivity) |
| POST | `/auth/register` | — | Register a customer, returns access token + sets refresh cookie |
| POST | `/auth/login` | — | Customer/staff login |
| POST | `/auth/admin/login` | — | Login restricted to STAFF / SUPER_ADMIN |
| POST | `/auth/refresh` | refresh cookie | Rotate tokens, return new access token |
| POST | `/auth/logout` | refresh cookie | Revoke refresh token, clear cookie |
| GET | `/auth/me` | access token | Current token identity |
| GET | `/users/me` | access token | Current user profile |
| PATCH | `/users/me` | access token | Update profile |
| GET | `/users/me/addresses` | access token | List addresses |
| POST | `/users/me/addresses` | access token | Add address |
| PATCH | `/users/me/addresses/:id` | access token | Update address |
| PATCH | `/users/me/addresses/:id/default` | access token | Set default address |
| DELETE | `/users/me/addresses/:id` | access token | Delete address |

**Auth model:** short-lived access token (sent as `Authorization: Bearer`, held in memory on the client) + long-lived refresh token (stored hashed in DB, rotated on use, delivered as an httpOnly + SameSite=Lax cookie).

---

## Testing

```bash
cd apps/api
npm test          # unit tests
npm run test:e2e  # integration/e2e tests (requires Postgres running)
```

Frontends are type-checked as part of their build:

```bash
npm run build --workspace @ecommerce/storefront
npm run build --workspace @ecommerce/admin
```

---

## Root scripts

| Script | Description |
|---|---|
| `npm run dev:api` / `dev:storefront` / `dev:admin` | Start a single app in dev |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run lint` | Lint all workspaces |

---

## Conventions

- **TypeScript strict** everywhere; no implicit `any`.
- Backend: Prisma only, validated DTOs on every input, guards on protected routes, DB transactions for multi-table integrity.
- Frontend: App Router, Zustand for client state, Zod for forms, all API calls centralized in `lib/api/*`.
- Design tokens live in `design.md` → Tailwind config; no hardcoded colors/fonts in components.
- Never trust client-sent price/stock; auth tokens never in localStorage.

See `rule.md` for the full ruleset.

---

## Roadmap

| Phase | Scope |
|---|---|
| 0 ✅ | Monorepo, NestJS, Prisma, health check, Next.js apps |
| 1 ✅ | Auth (JWT access+refresh), users, addresses, login/register UIs |
| 2 ⏳ | Product catalog (products, variants, categories, brands, images, search) |
| 3 | Cart & wishlist |
| 4 | Checkout, orders & payments |
| 5 | Admin order & inventory management |
| 6 | Coupons, reviews, marketing |
| 7 | Reports, settings, SEO & performance polish |
| 8 | Deployment |
