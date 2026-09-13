# Local Development Setup & Troubleshooting Guide

This guide documents the local setup prerequisites, one-command environment initialization, and troubleshooting steps for future development sessions.

---

## 1. Quick Start (One Command for Docker & Database)

Before running the API, storefront, admin, or test suites, ensure Docker and the local PostgreSQL container are active:

```bash
npm run docker:up
```

This executes `scripts/ensure-docker.ps1`, which:
1. Checks if the Docker engine daemon is responsive (`docker ps`).
2. If not running, launches Docker Desktop (`Docker Desktop.exe`), polls until the engine is ready (with timeout protection).
3. Verifies that the `ecommerce_postgres` container exists and is running.
4. Starts or provisions `ecommerce_postgres` (`postgres:16-alpine` on port `5432`).

---

## 2. Docker Desktop Auto-Start Configuration (Windows)

Docker Desktop is configured to start automatically on user login:
- **Settings Store:** `C:\Users\<user>\AppData\Roaming\Docker\settings-store.json` has `"AutoStart": true`.
- **Windows Startup Registry:**
  - `HKCU:\Software\Microsoft\Windows\CurrentVersion\Run` contains `Docker Desktop`.
  - `HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run` has `Docker Desktop` enabled (`0x02` binary flag, not disabled by Task Manager).
- **WSL2 Backend:**
  - Verify with `wsl --list -v` that `docker-desktop` is installed and running on WSL version 2.

If Docker is ever unresponsive, simply run:
```bash
npm run docker:up
```

---

## 3. Environment Variables & Seeding

1. Copy `.env.example` in `apps/api/`:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
2. Bootstrap the initial Super Admin:
   ```bash
   npm run seed:admin
   ```
   *(Requires `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` defined in `apps/api/.env`)*

---

## 4. Running the Monorepo

```bash
# Terminal 1 - Backend API (NestJS, port 4000)
npm run dev:api

# Terminal 2 - Customer Storefront (Next.js, port 3000)
npm run dev:storefront

# Terminal 3 - Admin Dashboard (Next.js, port 3001)
npm run dev:admin
```

---

## 5. Image Storage (Cloudinary) & Migration

1. Configure Cloudinary in `apps/api/.env`:
   ```bash
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
2. If migrating legacy local product images (`/uploads/...`) to Cloudinary:
   ```bash
   npm run migrate:images --workspace @ecommerce/api
   ```
   This uploads local disk files to Cloudinary and updates their database records with the secure HTTPS URLs.

