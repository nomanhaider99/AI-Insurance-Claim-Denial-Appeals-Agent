---
name: agent-pipeline
description: Background AI jobs in AppealAI — BullMQ queue/worker pattern, retries, idempotency, Claude API calls with Zod-validated structured output, storing prompt version and token usage, and keeping secrets/PHI out of logs. Use for extraction, classification, evidence, drafting or any LLM or long-running job.
---

# Agent pipeline (BullMQ + Claude)

## Layout

```
apps/api/src/jobs/queues.ts            Queue names + typed payloads + queue factories
apps/api/src/jobs/<name>.processor.ts  One processor per job type (pure-ish, testable)
apps/api/src/ai/prompts/<name>.ts      Prompt text + PROMPT_VERSION constant + Zod output schema
apps/api/src/ai/client.ts              Anthropic client wrapper (model, retries, usage capture)
apps/api/src/worker.ts                 Registers workers
```

## Rules

- **Enqueue from services, never from controllers.** Return `202` with the job or resource id. The UI polls or subscribes to status.
- **Payload = ids only:** `{ orgId, claimId, documentId, requestedBy }`. No document text, no PHI, no secrets in the payload.
- **Idempotency:** set `jobId` deterministically (e.g. `extract:<documentId>:<sha256>`). Processors check whether the output already exists before redoing work, and write results with upserts keyed on the input, so a retry never creates duplicates.
- **Retries:** `attempts: 3` (or more for rate limits), `backoff: { type: 'exponential', delay: 5000 }`. Throw `UnrecoverableError` for bad input (validation fails twice, missing document). `removeOnComplete`/`removeOnFail` with limits.
- **Claude calls:**
  - Use the current recommended Claude model from config (`AI_MODEL` env), not a hard-coded string in many places.
  - Use tool use / structured JSON output, then **validate with the prompt's Zod schema**. If it doesn't parse, retry once with the validation error included, then fail.
  - Send PDFs and images as document/image content blocks. Don't OCR yourself unless needed.
  - Prompts state: use only the provided documents; return `null` with low confidence when unsure; never invent codes or citations.
- **Audit record (`ai_meta` jsonb)** on every output: `{ model, promptVersion, inputIds: [...], sourceIds/citations, usage: { inputTokens, outputTokens }, latencyMs, jobId, createdAt }`.
- **Bump `PROMPT_VERSION`** whenever prompt text or the schema changes.
- **Human in the loop:** jobs only write drafts or suggestions. Nothing sets `approved` or `submitted`.
- **Logging:** log ids, job name, attempt, duration and token counts only. **Never** log prompts, model responses, document text, API keys or PHI (see `phi-security`).
- **Concurrency:** set per worker. Respect Anthropic rate limits (handle 429 with backoff).

## Checklist

- [ ] Typed payload with ids only, including `orgId`
- [ ] Deterministic `jobId`, and an idempotent processor (safe to run twice)
- [ ] Retries with backoff; `UnrecoverableError` for permanent failures
- [ ] Output validated by Zod; invalid output is never saved
- [ ] `ai_meta` stores model, promptVersion, inputs, sources, token usage
- [ ] No secrets, prompts, responses or PHI in logs
- [ ] Tests: processor with a mocked Claude client (valid output, invalid output → retry/fail, duplicate run is a no-op)
