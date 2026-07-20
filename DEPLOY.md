# PinNPost Deployment

## Env

**Edit only at repo root:**

| File | Purpose |
|------|---------|
| `.env` | Production / Docker |
| `.env.local` | Local overrides (gitignored) |

Then:

```bash
./pinn env:sync
```

That writes **only** these per app (no `.env.development` / `.env.production`):

- `api/.env` + `api/.env.local`
- `admin/.env` + `admin/.env.local`
- `mobile/.env` + `mobile/.env.local`

Docker still loads root `.env` at runtime. `up` / `build` / `deploy` run sync automatically.

## Setup

```bash
cp .env.example .env
cp .env.local.example .env.local   # optional
./pinn env:sync
./pinn up
```
