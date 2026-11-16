---
name: k8s-deploy
description: Containerisation and Kubernetes deployment for AppealAI (k3s on a VPS) — Dockerfile standards, health/readiness probes, resource requests/limits, HPA, secrets handling, and the rollout checklist. Use when editing Dockerfiles, docker-compose, infra/k8s manifests or the deploy workflow.
---

# Docker & Kubernetes deploy

## Dockerfiles (`infra/docker/`)

- Multi-stage builds: `build` installs with `pnpm install --frozen-lockfile --filter <pkg>...` and builds; `runtime` copies only what is needed (Next.js `standalone` output for web; `dist` + prod deps for api).
- Pin base images (`node:24-alpine`, eventually by digest) and pin the pnpm version to match `packageManager`.
- Run as a **non-root** user (`USER node`). Read-only root filesystem where possible. No secrets in build args or layers. `.dockerignore` excludes `node_modules`, `.env*`, `.git`.
- One API image serves `api`, `worker` and `migrate` (different `command`).
- `NEXT_PUBLIC_*` values are baked in at build time. Anything secret must not be `NEXT_PUBLIC_`.

## Kubernetes (`infra/k8s/`)

- **Workloads:** Deployments for `web`, `api`, `worker`. A `migrate` Job (or Helm hook / initContainer) runs before the api rollout. CronJobs for deadline reminders.
- **Probes:**
  - api: `livenessProbe` → `GET /health`; `readinessProbe` → `GET /health/ready`; `startupProbe` for slow boots.
  - web: HTTP probe on `/`.
  - worker: exec probe or a small health port. Liveness must not depend on external services, so a DB blip doesn't trigger restart loops.
- **Resources:** every container sets `requests` and `limits` for CPU and memory (start: api 250m/512Mi, worker 500m/1Gi, web 250m/512Mi; tune from metrics).
- **HPA:** api and web scale on CPU (~70%); worker scales on CPU or queue depth. `minReplicas: 2` for api/web in production. Add PodDisruptionBudgets.
- **Secrets:** K8s Secrets (sealed-secrets or SOPS in git, never plain). Mount as env vars. `JWT_*`, `DATABASE_URL`, `S3_*`, `ANTHROPIC_API_KEY` are never in ConfigMaps, images or logs.
- **Networking:** Ingress with TLS (cert-manager + Let's Encrypt), HTTPS only, HSTS. NetworkPolicies so only api/worker reach Postgres, Redis and MinIO.
- **Stateful services** (Postgres+pgvector, Redis, MinIO): StatefulSets with PVCs and backups, or managed equivalents. Postgres backups are tested by restoring.
- **Graceful shutdown:** apps handle SIGTERM (already in `server.ts`/`worker.ts`). Set `terminationGracePeriodSeconds` longer than the longest job step.

## Rollout checklist

- [ ] CI green; images built and tagged with the git SHA (never `latest` in manifests)
- [ ] Migrations are backwards compatible with the running version and applied before the new api starts
- [ ] Secrets present in the target namespace; nothing secret in ConfigMaps
- [ ] Probes, requests/limits, HPA and PDB set for every workload
- [ ] `kubectl rollout status` succeeds; `/health/ready` returns 200 through the ingress over HTTPS
- [ ] Smoke test: log in, open the dashboard, queue a synthetic job and see it processed
- [ ] Rollback plan: `kubectl rollout undo` and a DB restore point for risky migrations
