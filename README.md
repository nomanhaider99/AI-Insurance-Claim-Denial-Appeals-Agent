# AppealAI

AI-assisted insurance claim denial appeals: extract the denial, retrieve payer policy, draft a cited appeal — a human always reviews and approves.

> Synthetic / de-identified data only. Never load real patient data.

## Quick start (Docker)

```sh
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:4000/health and http://localhost:4000/health/ready
- MinIO console: http://localhost:9001 (minioadmin / minioadmin)

## Local development

```sh
pnpm install
cp .env.example .env
docker compose up -d postgres redis minio minio-init
pnpm migrate
pnpm dev            # web + api
pnpm --filter @appeal/api dev:worker
```

## Commands

| Command            | What it does                     |
| ------------------ | -------------------------------- |
| `pnpm dev`         | Run web and api in watch mode    |
| `pnpm test`        | Unit + API tests (Vitest)        |
| `pnpm lint`        | ESLint + Prettier check          |
| `pnpm typecheck`   | TypeScript across all packages   |
| `pnpm migrate`     | Apply Drizzle migrations         |
| `pnpm db:generate` | Generate a migration from schema |
| `pnpm db:seed`     | Seed synthetic data              |

See [PLAN.md](PLAN.md) for the roadmap and [docs/architecture.md](docs/architecture.md) for the design.
